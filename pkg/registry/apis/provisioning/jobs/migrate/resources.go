package migrate

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

var _ resource.BulkResourceWriter = (*resourceReader)(nil)

type resourceReader struct {
	job *migrationJob
}

// Close implements resource.BulkResourceWriter.
func (r *resourceReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWriter.
func (r *resourceReader) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWriter.
func (r *resourceReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	// Reuse the same parse+cleanup logic
	parsed, err := r.job.parser.Parse(ctx, &repository.FileInfo{
		Path: "", // empty path to ignore file system
		Data: value,
	}, false)
	if err != nil {
		return fmt.Errorf("failed to unmarshal unstructured: %w", err)
	}

	// clear anything so it will get written
	parsed.Meta.SetManagerProperties(utils.ManagerProperties{})
	parsed.Meta.SetSourceProperties(utils.SourceProperties{})

	// TODO: this seems to be same logic as the export job
	if result := r.job.write(ctx, parsed.Obj); result.Error != nil {
		r.job.progress.Record(ctx, result)
		if err := r.job.progress.TooManyErrors(); err != nil {
			return err
		}
	}

	return nil
}

func (j *migrationJob) migrateLegacyResources(ctx context.Context) error {
	for _, kind := range resources.SupportedResources {
		// Skip folders, they are handled separately
		if kind.Resource == folders.RESOURCE {
			continue
		}

		j.progress.SetMessage(ctx, fmt.Sprintf("migrate %s resource", kind.Resource))
		opts := legacy.MigrateOptions{
			Namespace:   j.namespace,
			WithHistory: j.options.History,
			Resources:   []schema.GroupResource{kind},
			Store:       parquet.NewBulkResourceWriterClient(&resourceReader{job: j}),
			OnlyCount:   true, // first get the count
		}
		stats, err := j.legacy.Migrate(ctx, opts)
		if err != nil {
			return fmt.Errorf("unable to count legacy items %w", err)
		}

		// FIXME: explain why we calculate it in this way
		if len(stats.Summary) > 0 {
			count := stats.Summary[0].Count //
			history := stats.Summary[0].History
			if history > count {
				count = history // the number of items we will process
			}
			j.progress.SetTotal(ctx, int(count))
		}

		opts.OnlyCount = false // this time actually write
		_, err = j.legacy.Migrate(ctx, opts)
		if err != nil {
			return fmt.Errorf("error running legacy migrate %s %w", kind.Resource, err)
		}
	}
	return nil
}

// TODO: this is copied from the export job
func (j *migrationJob) write(ctx context.Context, obj *unstructured.Unstructured) jobs.JobResourceResult {
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
	manager, _ := meta.GetManagerProperties()
	if manager.Identity == j.target.Config().GetName() {
		result.Action = repository.FileActionIgnored
		return result
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Add the author in context (if available)
	ctx = j.withAuthorSignature(ctx, meta)

	// Get the absolute path of the folder
	fid, ok := j.folderTree.DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		j.logger.Error("folder of item was not in tree of repository")
	}

	result.Path = fid.Path

	// Clear the metadata
	delete(obj.Object, "metadata")

	if j.options.Identifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		result.Error = fmt.Errorf("failed to marshal dashboard: %w", err)
		return result
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}

	err = j.target.Write(ctx, fileName, "", body, commitMessage)
	if err != nil {
		result.Error = fmt.Errorf("failed to write file: %w", err)
	}

	return result
}

// TODO: should this be part of resources package?
func (w *MigrationWorker) removeUnprovisioned(ctx context.Context, repo repository.ReaderWriter, progress jobs.JobProgressRecorder) error {
	parser, err := w.parsers.GetParser(ctx, repo)
	if err != nil {
		return fmt.Errorf("error getting parser: %w", err)
	}

	return parser.Clients().ForEachSupportedResource(ctx, func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}

		// Skip if managed
		_, ok := meta.GetManagerProperties()
		if ok {
			return nil
		}

		result := jobs.JobResourceResult{
			Name:     item.GetName(),
			Resource: item.GetKind(),
			Group:    item.GroupVersionKind().Group,
			Action:   repository.FileActionDeleted,
		}

		if err = client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
			result.Error = fmt.Errorf("failed to delete folder: %w", err)
			progress.Record(ctx, result)
			return result.Error
		}

		progress.Record(ctx, result)

		return nil
	})
}
