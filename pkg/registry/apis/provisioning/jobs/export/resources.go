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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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
		// TODO: should we fail the entire execution?
		return fmt.Errorf("failed to unmarshal unstructured: %w", err)
	}

	if result := f.job.write(ctx, item); result.Error != nil {
		f.job.progress.Record(ctx, result)
		if len(f.job.progress.Errors()) > 20 {
			return fmt.Errorf("stopping execution due to too many errors")
		}
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
			r.progress.Record(ctx, r.write(ctx, &item))
			if len(r.progress.Errors()) > 20 {
				return fmt.Errorf("stopping execution due to too many errors")
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}

func (r *exportJob) write(ctx context.Context, obj *unstructured.Unstructured) jobs.JobResourceResult {
	gvk := obj.GroupVersionKind()
	result := jobs.JobResourceResult{
		Name:     obj.GetName(),
		Resource: gvk.Kind,
		Group:    gvk.Group,
		Action:   repository.FileActionCreated,
	}

	if err := ctx.Err(); err != nil {
		result.Error = fmt.Errorf("context error: %w", err)
		return result
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		result.Error = fmt.Errorf("extract meta accessor: %w", err)
		return result
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
		result.Action = repository.FileActionIgnored
		return result
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

	result.Path = fid.Path

	// Clear the metadata
	delete(obj.Object, "metadata")

	if r.keepIdentifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		result.Error = fmt.Errorf("failed to marshal dashboard: %w", err)
		return result
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName, err = safepath.Join(fid.Path, fileName)
		if err != nil {
			result.Error = fmt.Errorf("error adding file path: %w", err)
			return result
		}
	}
	if r.prefix != "" {
		fileName, err = safepath.Join(r.prefix, fileName)
		if err != nil {
			result.Error = fmt.Errorf("error adding path prefix: %w", err)
			return result
		}
	}

	err = r.target.Write(ctx, fileName, r.ref, body, commitMessage)
	if err != nil {
		result.Error = fmt.Errorf("failed to write file: %w", err)
	}

	return result
}
