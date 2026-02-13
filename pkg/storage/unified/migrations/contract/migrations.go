package contract

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// UnifiedStorageMigrationService provides unified storage migrations as a background service.
// This interface is defined in a separate package to avoid import cycles between
// the migrations implementation and packages that need to depend on it (like dualwrite).
type UnifiedStorageMigrationService interface {
	registry.BackgroundService
}

// MigrationStatusReader provides a way to check whether a resource has been migrated
// to unified storage. This is the single source of truth for determining the storage
// mode (Legacy vs Unified) for any given resource.
//
// The implementation checks the unifiedstorage_migration_log table as the primary source.
// As a temporary fallback for environments where data migrations are run externally
// (e.g., Grafana Cloud), it also consults the static configuration.
type MigrationStatusReader interface {
	IsMigrated(ctx context.Context, gr schema.GroupResource) (bool, error)
}
