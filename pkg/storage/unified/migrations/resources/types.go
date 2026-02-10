package resources

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// MigrateOptions contains configuration for a resource migration operation.
type MigrateOptions struct {
	Namespace   string
	Resources   []schema.GroupResource
	WithHistory bool // only applies to dashboards
	OnlyCount   bool // just count the values
	Progress    func(count int, msg string)
}

// ResourceMigrationService centralizes all resource migration logic behind a single
// service. It combines dashboard, folder, library panel, and playlist migration
// capabilities so that the unified migration system depends on one service.
//
//go:generate mockery --name ResourceMigrationService --structname MockResourceMigrationService --inpackage --filename resource_migration_service_mock.go --with-expecter
type ResourceMigrationService interface {
	CountResources(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error)
	MigrateDashboards(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigrateFolders(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigrateLibraryPanels(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigratePlaylists(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}
