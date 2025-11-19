package legacy

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type MigrateOptions struct {
	Namespace   string
	Resources   []schema.GroupResource
	WithHistory bool // only applies to dashboards
	OnlyCount   bool // just count the values
	Progress    func(count int, msg string)
}

// Read from legacy and write into unified storage
//
//go:generate mockery --name LegacyMigrator --structname MockLegacyMigrator --inpackage --filename legacy_migrator_mock.go --with-expecter
type LegacyMigrator interface {
	Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error)
}

// legacyResourceMigrator handles the migration of legacy resources to unified storage
type legacyResourceMigrator struct {
	dashboardAccess MigratorDashboardAccess
	streamProvider  streamProvider
	log             log.Logger
}

// streamProvider abstracts the different ways to create a bulk process stream
type streamProvider interface {
	createStream(ctx context.Context, opts MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error)
}

// resourceClientStreamProvider creates streams using resource.ResourceClient
type resourceClientStreamProvider struct {
	client resource.ResourceClient
}

func (r *resourceClientStreamProvider) createStream(ctx context.Context, opts MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
	// Build collection settings for resource client
	settings := resource.BulkSettings{
		RebuildCollection: true,
		SkipValidation:    true,
	}
	for _, res := range opts.Resources {
		switch fmt.Sprintf("%s/%s", res.Group, res.Resource) {
		case "folder.grafana.app/folders":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     folders.GROUP,
				Resource:  folders.RESOURCE,
			})
		case "dashboard.grafana.app/librarypanels":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.LIBRARY_PANEL_RESOURCE,
			})
		case "dashboard.grafana.app/dashboards":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.DASHBOARD_RESOURCE,
			})
		}
	}
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	return r.client.BulkProcess(ctx)
}

// bulkStoreClientStreamProvider creates streams using resourcepb.BulkStoreClient
type bulkStoreClientStreamProvider struct {
	client resourcepb.BulkStoreClient
}

func (b *bulkStoreClientStreamProvider) createStream(ctx context.Context, opts MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
	// Build collection settings for resource client
	settings := resource.BulkSettings{
		RebuildCollection: true,
		SkipValidation:    true,
	}
	for _, res := range opts.Resources {
		switch fmt.Sprintf("%s/%s", res.Group, res.Resource) {
		case "folder.grafana.app/folders":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     folders.GROUP,
				Resource:  folders.RESOURCE,
			})
		case "dashboard.grafana.app/librarypanels":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.LIBRARY_PANEL_RESOURCE,
			})
		case "dashboard.grafana.app/dashboards":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.DASHBOARD_RESOURCE,
			})
		}
	}
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	return b.client.BulkProcess(ctx)
}

// This can migrate Folders, Dashboards and LibraryPanels
func ProvideLegacyMigrator(
	dashboardAccess MigratorDashboardAccess,
	client resource.ResourceClient,
) LegacyMigrator {
	return newLegacyResourceMigrator(
		dashboardAccess,
		&resourceClientStreamProvider{client: client},
		log.New("legacy-migrator"),
	)
}

func ProvideLegacyMigratorParquet(
	dashboardAccess MigratorDashboardAccess,
	client resourcepb.BulkStoreClient,
) LegacyMigrator {
	return newLegacyResourceMigrator(
		dashboardAccess,
		&bulkStoreClientStreamProvider{client: client},
		log.New("legacy-migrator-parquet"),
	)
}

func newLegacyResourceMigrator(
	dashboardAccess MigratorDashboardAccess,
	streamProvider streamProvider,
	log log.Logger,
) LegacyMigrator {
	return &legacyResourceMigrator{
		dashboardAccess: dashboardAccess,
		streamProvider:  streamProvider,
		log:             log,
	}
}

type BlobStoreInfo struct {
	Count int64
	Size  int64
}

// migrate function -- works for a single kind
type migratorFunc = func(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error)

func (m *legacyResourceMigrator) Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error) {
	info, err := authlib.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}
	if opts.Progress == nil {
		opts.Progress = func(count int, msg string) {} // noop
	}

	if len(opts.Resources) < 1 {
		return nil, fmt.Errorf("missing resource selector")
	}

	if opts.OnlyCount {
		return m.dashboardAccess.CountResources(ctx, opts)
	}

	stream, err := m.streamProvider.createStream(ctx, opts)
	if err != nil {
		return nil, err
	}

	migratorFuncs := []migratorFunc{}
	for _, res := range opts.Resources {
		switch fmt.Sprintf("%s/%s", res.Group, res.Resource) {
		case "folder.grafana.app/folders":
			migratorFuncs = append(migratorFuncs, m.migrateFolders)
		case "dashboard.grafana.app/librarypanels":
			migratorFuncs = append(migratorFuncs, m.migratePanels)
		case "dashboard.grafana.app/dashboards":
			migratorFuncs = append(migratorFuncs, m.migrateDashboards)
		default:
			return nil, fmt.Errorf("unsupported resource: %s", res)
		}
	}

	// Execute migrations
	blobStore := BlobStoreInfo{}
	m.log.Info("start migrating legacy resources", "namespace", opts.Namespace, "orgId", info.OrgID, "stackId", info.StackID)
	for _, fn := range migratorFuncs {
		blobs, err := fn(ctx, info.OrgID, opts, stream)
		if err != nil {
			m.log.Error("error migrating legacy resources", "error", err, "namespace", opts.Namespace)
			return nil, err
		}
		if blobs != nil {
			blobStore.Count += blobs.Count
			blobStore.Size += blobs.Size
		}
	}
	m.log.Info("finished migrating legacy resources", "blobStore", blobStore)
	return stream.CloseAndRecv()
}

func (m *legacyResourceMigrator) migrateDashboards(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	// Delegate to the appropriate dashboard migration strategy
	return m.dashboardAccess.MigrateDashboards(ctx, orgId, opts, stream)
}

func (m *legacyResourceMigrator) migrateFolders(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	// Delegate to dashboard access for folder migration
	return m.dashboardAccess.MigrateFolders(ctx, orgId, opts, stream)
}

func (m *legacyResourceMigrator) migratePanels(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	// Delegate to dashboard access for panel migration
	return m.dashboardAccess.MigrateLibraryPanels(ctx, orgId, opts, stream)
}
