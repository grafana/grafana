package migrate

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources/signature"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ resource.BulkResourceWriter = (*legacyResourceResourceMigrator)(nil)

//go:generate mockery --name LegacyResourcesMigrator --structname MockLegacyResourcesMigrator --inpackage --filename mock_legacy_resources_migrator.go --with-expecter
type LegacyResourcesMigrator interface {
	Migrate(ctx context.Context, rw repository.ReaderWriter, namespace string, opts provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error
}

type legacyResourcesMigrator struct {
	repositoryResources resources.RepositoryResourcesFactory
	parsers             resources.ParserFactory
	legacyMigrator      legacy.LegacyMigrator
	signerFactory       signature.SignerFactory
	clients             resources.ClientFactory
	exportFn            export.ExportFn
}

func NewLegacyResourcesMigrator(
	repositoryResources resources.RepositoryResourcesFactory,
	parsers resources.ParserFactory,
	legacyMigrator legacy.LegacyMigrator,
	signerFactory signature.SignerFactory,
	clients resources.ClientFactory,
	exportFn export.ExportFn,
) LegacyResourcesMigrator {
	return &legacyResourcesMigrator{
		repositoryResources: repositoryResources,
		parsers:             parsers,
		legacyMigrator:      legacyMigrator,
		signerFactory:       signerFactory,
		clients:             clients,
		exportFn:            exportFn,
	}
}

func (m *legacyResourcesMigrator) Migrate(ctx context.Context, rw repository.ReaderWriter, namespace string, opts provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	parser, err := m.parsers.GetParser(ctx, rw)
	if err != nil {
		return fmt.Errorf("get parser: %w", err)
	}

	repositoryResources, err := m.repositoryResources.Client(ctx, rw)
	if err != nil {
		return fmt.Errorf("get repository resources: %w", err)
	}

	// FIXME: signature is only relevant for repositories which support signature
	// Not all repositories support history
	signer, err := m.signerFactory.New(ctx, signature.SignOptions{
		Namespace: namespace,
		History:   opts.History,
	})
	if err != nil {
		return fmt.Errorf("get signer: %w", err)
	}

	progress.SetMessage(ctx, "migrate folders from SQL")
	clients, err := m.clients.Clients(ctx, namespace)
	if err != nil {
		return err
	}

	// nothing special for the export for now
	exportOpts := provisioning.ExportJobOptions{}
	if err = m.exportFn(ctx, rw.Config().Name, exportOpts, clients, repositoryResources, progress); err != nil {
		return fmt.Errorf("migrate folders from SQL: %w", err)
	}

	progress.SetMessage(ctx, "migrate resources from SQL")
	for _, kind := range resources.SupportedProvisioningResources {
		if kind == resources.FolderResource {
			continue // folders have special handling
		}

		reader := newLegacyResourceMigrator(
			rw,
			m.legacyMigrator,
			parser,
			repositoryResources,
			progress,
			opts,
			namespace,
			kind.GroupResource(),
			signer,
		)

		if err := reader.Migrate(ctx); err != nil {
			return fmt.Errorf("migrate resource %s: %w", kind, err)
		}
	}

	return nil
}

type legacyResourceResourceMigrator struct {
	repo      repository.ReaderWriter
	legacy    legacy.LegacyMigrator
	parser    resources.Parser
	progress  jobs.JobProgressRecorder
	namespace string
	kind      schema.GroupResource
	options   provisioning.MigrateJobOptions
	resources resources.RepositoryResources
	signer    signature.Signer
	history   map[string]string // UID >> file path
}

func newLegacyResourceMigrator(
	repo repository.ReaderWriter,
	legacy legacy.LegacyMigrator,
	parser resources.Parser,
	resources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	options provisioning.MigrateJobOptions,
	namespace string,
	kind schema.GroupResource,
	signer signature.Signer,
) *legacyResourceResourceMigrator {
	var history map[string]string
	if options.History {
		history = make(map[string]string)
	}
	return &legacyResourceResourceMigrator{
		repo:      repo,
		legacy:    legacy,
		parser:    parser,
		progress:  progress,
		options:   options,
		namespace: namespace,
		kind:      kind,
		resources: resources,
		signer:    signer,
		history:   history,
	}
}

// Close implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) CloseWithResults() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWriter.
func (r *legacyResourceResourceMigrator) Write(ctx context.Context, key *resourcepb.ResourceKey, value []byte) error {
	// Reuse the same parse+cleanup logic
	parsed, err := r.parser.Parse(ctx, &repository.FileInfo{
		Path: "", // empty path to ignore file system
		Data: value,
	})
	if err != nil {
		return fmt.Errorf("unmarshal unstructured: %w", err)
	}

	// clear anything so it will get written
	parsed.Meta.SetManagerProperties(utils.ManagerProperties{})
	parsed.Meta.SetSourceProperties(utils.SourceProperties{})

	// Add author signature to the context
	ctx, err = r.signer.Sign(ctx, parsed.Meta)
	if err != nil {
		return fmt.Errorf("add author signature: %w", err)
	}

	// TODO: this seems to be same logic as the export job
	// TODO: we should use a kind safe manager here
	fileName, err := r.resources.WriteResourceFileFromObject(ctx, parsed.Obj, resources.WriteOptions{
		Path: "",
		Ref:  "",
	})

	// When replaying history, the path to the file may change over time
	// This happens when the title or folder change
	if r.history != nil && err == nil {
		name := parsed.Meta.GetName()
		previous := r.history[name]
		if previous != "" && previous != fileName {
			err = r.repo.Delete(ctx, previous, "", fmt.Sprintf("moved to: %s", fileName))
		}
		r.history[name] = fileName
	}

	result := jobs.JobResourceResult{
		Name:     parsed.Meta.GetName(),
		Resource: r.kind.Resource,
		Group:    r.kind.Group,
		Action:   repository.FileActionCreated,
		Path:     fileName,
	}

	if err != nil {
		result.Error = fmt.Errorf("writing resource %s/%s %s to file %s: %w", r.kind.Group, r.kind.Resource, parsed.Meta.GetName(), fileName, err)
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
		return fmt.Errorf("migrate legacy %s: %w", r.kind.Resource, err)
	}

	return nil
}
