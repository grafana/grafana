package migrate

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var _ resource.BulkResourceWriter = (*legacyResourceResourceMigrator)(nil)

// TODO: can we use the same migrator for folders?
type legacyResourceResourceMigrator struct {
	repo       repository.ReaderWriter
	legacy     legacy.LegacyMigrator
	parser     *resources.Parser
	folderTree *resources.FolderTree
	progress   jobs.JobProgressRecorder
	namespace  string
	kind       schema.GroupResource
	options    provisioning.MigrateJobOptions
	userInfo   map[string]repository.CommitSignature
}

func NewLegacyResourceMigrator(repo repository.ReaderWriter, legacy legacy.LegacyMigrator, parser *resources.Parser, folderTree *resources.FolderTree, progress jobs.JobProgressRecorder, options provisioning.MigrateJobOptions, namespace string, kind schema.GroupResource, userInfo map[string]repository.CommitSignature) *legacyResourceResourceMigrator {
	return &legacyResourceResourceMigrator{
		repo:       repo,
		legacy:     legacy,
		parser:     parser,
		folderTree: folderTree,
		progress:   progress,
		options:    options,
		namespace:  namespace,
		kind:       kind,
		userInfo:   userInfo,
	}
}

// Close implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	// Reuse the same parse+cleanup logic
	parsed, err := r.parser.Parse(ctx, &repository.FileInfo{
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
	fileName, err := r.write(ctx, parsed.Obj, r.folderTree)
	result := jobs.JobResourceResult{
		Name:     parsed.Meta.GetName(),
		Resource: r.kind.Resource,
		Group:    r.kind.Group,
		Action:   repository.FileActionCreated,
		Error:    err,
		Path:     fileName,
	}

	r.progress.Record(ctx, result)
	if err := r.progress.TooManyErrors(); err != nil {
		return err
	}

	return nil
}

func (r *legacyResourceResourceMigrator) Migrate(ctx context.Context) error {
	r.progress.SetMessage(ctx, fmt.Sprintf("migrate %s resource", r.kind.Resource))
	opts := legacy.MigrateOptions{
		Namespace:   r.namespace,
		WithHistory: r.options.History,
		Resources:   []schema.GroupResource{r.kind},
		Store:       parquet.NewBulkResourceWriterClient(r),
		OnlyCount:   true, // first get the count
	}
	stats, err := r.legacy.Migrate(ctx, opts)
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
		r.progress.SetTotal(ctx, int(count))
	}

	opts.OnlyCount = false // this time actually write
	_, err = r.legacy.Migrate(ctx, opts)
	if err != nil {
		return fmt.Errorf("error running legacy migrate %s %w", r.kind.Resource, err)
	}

	return nil
}

// TODO: this is copied from the export job
func (r *legacyResourceResourceMigrator) write(ctx context.Context, obj *unstructured.Unstructured, folderTree *resources.FolderTree) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", fmt.Errorf("context error: %w", err)
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return "", fmt.Errorf("extract meta accessor: %w", err)
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
	// TODO: how to handle this better?
	manager, _ := meta.GetManagerProperties()
	if manager.Identity == r.repo.Config().GetName() {
		return "", nil
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Add the author in context (if available)
	ctx = r.withAuthorSignature(ctx, meta)

	// Get the absolute path of the folder
	fid, ok := folderTree.DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		// j.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	if r.options.Identifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal dashboard: %w", err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}

	err = r.repo.Write(ctx, fileName, "", body, commitMessage)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fileName, nil
}

// TODO: this is copied from the export job
func (r *legacyResourceResourceMigrator) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if r.userInfo == nil {
		return ctx
	}
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := r.userInfo[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig)
}
