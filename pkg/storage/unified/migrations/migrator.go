package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Read from legacy and write into unified storage
//
//go:generate mockery --name UnifiedMigrator --structname MockUnifiedMigrator --inpackage --filename migrator_mock.go --with-expecter
type UnifiedMigrator interface {
	Migrate(ctx context.Context, opts legacy.MigrateOptions) (*resourcepb.BulkResponse, error)
}

// unifiedMigration handles the migration of legacy resources to unified storage
type unifiedMigration struct {
	legacy.MigrationDashboardAccessor
	streamProvider streamProvider
	log            log.Logger
}

// streamProvider abstracts the different ways to create a bulk process stream
type streamProvider interface {
	createStream(ctx context.Context, opts legacy.MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error)
}

// resourceClientStreamProvider creates streams using resource.ResourceClient
type resourceClientStreamProvider struct {
	client resource.ResourceClient
}

func (r *resourceClientStreamProvider) createStream(ctx context.Context, opts legacy.MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
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
				Group:     v1beta1.GROUP,
				Resource:  v1beta1.LIBRARY_PANEL_RESOURCE,
			})
		case "dashboard.grafana.app/dashboards":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     v1beta1.GROUP,
				Resource:  v1beta1.DASHBOARD_RESOURCE,
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

func (b *bulkStoreClientStreamProvider) createStream(ctx context.Context, opts legacy.MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
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
				Group:     v1beta1.GROUP,
				Resource:  v1beta1.LIBRARY_PANEL_RESOURCE,
			})
		case "dashboard.grafana.app/dashboards":
			settings.Collection = append(settings.Collection, &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     v1beta1.GROUP,
				Resource:  v1beta1.DASHBOARD_RESOURCE,
			})
		}
	}
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	return b.client.BulkProcess(ctx)
}

// This can migrate Folders, Dashboards and LibraryPanels
func ProvideUnifiedMigrator(
	dashboardAccess legacy.MigrationDashboardAccessor,
	client resource.ResourceClient,
) UnifiedMigrator {
	return newUnifiedMigrator(
		dashboardAccess,
		&resourceClientStreamProvider{client: client},
		log.New("storage.unified.migrator"),
	)
}

func ProvideUnifiedMigratorParquet(
	dashboardAccess legacy.MigrationDashboardAccessor,
	client resourcepb.BulkStoreClient,
) UnifiedMigrator {
	return newUnifiedMigrator(
		dashboardAccess,
		&bulkStoreClientStreamProvider{client: client},
		log.New("storage.unified.migrator.parquet"),
	)
}

func newUnifiedMigrator(
	dashboardAccess legacy.MigrationDashboardAccessor,
	streamProvider streamProvider,
	log log.Logger,
) UnifiedMigrator {
	return &unifiedMigration{
		MigrationDashboardAccessor: dashboardAccess,
		streamProvider:             streamProvider,
		log:                        log,
	}
}

// migrate function -- works for a single kind
type migratorFunc = func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*legacy.BlobStoreInfo, error)

func (m *unifiedMigration) Migrate(ctx context.Context, opts legacy.MigrateOptions) (*resourcepb.BulkResponse, error) {
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
		return m.CountResources(ctx, opts)
	}

	stream, err := m.streamProvider.createStream(ctx, opts)
	if err != nil {
		return nil, err
	}

	migratorFuncs := []migratorFunc{}
	for _, res := range opts.Resources {
		switch fmt.Sprintf("%s/%s", res.Group, res.Resource) {
		case "folder.grafana.app/folders":
			migratorFuncs = append(migratorFuncs, m.MigrateFolders)
		case "dashboard.grafana.app/librarypanels":
			migratorFuncs = append(migratorFuncs, m.MigrateLibraryPanels)
		case "dashboard.grafana.app/dashboards":
			migratorFuncs = append(migratorFuncs, m.MigrateDashboards)
		default:
			return nil, fmt.Errorf("unsupported resource: %s", res)
		}
	}

	// Execute migrations
	blobStore := legacy.BlobStoreInfo{}
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
