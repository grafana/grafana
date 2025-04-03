package migrate

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ resource.BulkResourceWriter = (*legacyResourceResourceMigrator)(nil)

// TODO: can we use the same migrator for folders?
type legacyResourceResourceMigrator struct {
	legacy    legacy.LegacyMigrator
	parser    *resources.Parser
	progress  jobs.JobProgressRecorder
	namespace string
	kind      schema.GroupResource
	options   provisioning.MigrateJobOptions
	resources *resources.ResourcesManager
}

func NewLegacyResourceMigrator(legacy legacy.LegacyMigrator, parser *resources.Parser, resources *resources.ResourcesManager, progress jobs.JobProgressRecorder, options provisioning.MigrateJobOptions, namespace string, kind schema.GroupResource) *legacyResourceResourceMigrator {
	return &legacyResourceResourceMigrator{
		legacy:    legacy,
		parser:    parser,
		progress:  progress,
		options:   options,
		namespace: namespace,
		kind:      kind,
		resources: resources,
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
	// TODO: we should use a kind safe manager here
	fileName, err := r.resources.CreateResourceFileFromObject(ctx, parsed.Obj, resources.WriteOptions{
		Path: "",
		Ref:  "",
	})

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
		return fmt.Errorf("error running legacy migrate (%s) %w", r.kind.Resource, err)
	}

	return nil
}
