package export

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ resource.BatchResourceWriter = (*resourceReader)(nil)

type resourceReader struct {
	job *exportJob
}

// Close implements resource.BatchResourceWriter.
func (f *resourceReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BatchResourceWriter.
func (f *resourceReader) CloseWithResults() (*resource.BatchResponse, error) {
	return &resource.BatchResponse{}, nil
}

// Write implements resource.BatchResourceWriter.
func (f *resourceReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("failed to unmarshal unstructured: %w", err)
	}

	if err := f.job.write(ctx, item); err != nil {
		return fmt.Errorf("write legacy item: %w", err)
	}

	return nil
}

func (r *exportJob) loadResources(ctx context.Context) error {
	kinds := []schema.GroupVersionResource{{
		Group:    dashboards.GROUP,
		Resource: dashboards.DASHBOARD_RESOURCE,
		Version:  "v1alpha1",
	}}

	for _, kind := range kinds {
		r.progress.SetMessage(fmt.Sprintf("exporting %s resource", kind.Resource))
		if r.legacy != nil {
			r.progress.SetMessage(fmt.Sprintf("migrate %s resource", kind.Resource))
			gr := kind.GroupResource()
			opts := legacy.MigrateOptions{
				Namespace:   r.namespace,
				WithHistory: r.withHistory,
				Resources:   []schema.GroupResource{gr},
				Store:       parquet.NewBatchResourceWriterClient(&resourceReader{job: r}),
				OnlyCount:   true, // first get the count
			}
			stats, err := r.legacy.Migrate(ctx, opts)
			if err != nil {
				return fmt.Errorf("unable to count legacy items %w", err)
			}

			// FIXME: explain why we calculate it in this way
			if len(stats.Summary) > 0 {
				count := stats.Summary[0].Count
				history := stats.Summary[0].History
				if history > count {
					count = history // the number of items we will process
				}
				r.progress.SetTotal(int(count))
			}

			opts.OnlyCount = false // this time actually write
			_, err = r.legacy.Migrate(ctx, opts)
			if err != nil {
				return fmt.Errorf("error running legacy migrate %s %w", kind.Resource, err)
			}
		}

		r.progress.SetMessage(fmt.Sprintf("reading %s resource", kind.Resource))
		if err := r.loadResourcesFromAPIServer(ctx, kind); err != nil {
			return fmt.Errorf("error loading %s %w", kind.Resource, err)
		}
	}
	return nil
}

func (r *exportJob) loadResourcesFromAPIServer(ctx context.Context, kind schema.GroupVersionResource) error {
	client := r.client.Resource(kind)

	var continueToken string
	for {
		list, err := client.List(ctx, metav1.ListOptions{Limit: 100, Continue: continueToken})
		if err != nil {
			return fmt.Errorf("error executing list: %w", err)
		}

		for _, item := range list.Items {
			// TODO: when to stop execution?
			if err = r.write(ctx, &item); err != nil {
				return fmt.Errorf("error adding value: %w", err)
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}

func (r *exportJob) write(ctx context.Context, obj *unstructured.Unstructured) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("context error: %w", err)
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("extract meta accessor: %w", err)
	}

	// Message from annotations
	commitMessage := meta.GetMessage()
	if commitMessage == "" {
		g := meta.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

	name := meta.GetName()
	repoName := meta.GetRepositoryName()
	if repoName == r.target.Config().GetName() {
		r.logger.Info("skip dashboard since it is already in repository", "dashboard", name)
		// TODO: add ignore
		return nil
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Add the author in context (if available)
	ctx = r.withAuthorSignature(ctx, meta)

	// Get the absolute path of the folder
	fid, ok := r.folderTree.DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		r.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	if r.keepIdentifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName, err = safepath.Join(fid.Path, fileName)
		if err != nil {
			return fmt.Errorf("error adding file path %s: %w", title, err)
		}
	}
	if r.prefix != "" {
		fileName, err = safepath.Join(r.prefix, fileName)
		if err != nil {
			return fmt.Errorf("error adding path prefix %s: %w", r.prefix, err)
		}
	}

	// Write the file
	err = r.target.Write(ctx, fileName, r.ref, body, commitMessage)
	if err != nil {
		// summary.Error++
		r.logger.Error("failed to write a file in repository", "error", err)
		// if len(summary.Errors) < 20 {
		// 	summary.Errors = append(summary.Errors, fmt.Sprintf("error writing: %s", fileName))
		// }
	} else {
		// summary.Write++
	}

	return nil
}
