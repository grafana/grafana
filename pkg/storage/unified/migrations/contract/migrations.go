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

// StorageMode represents the storage mode for a resource.
// This is the simplified model replacing the previous 5-mode system (Mode0-Mode5).
type StorageMode int

const (
	// StorageModeLegacy means all reads and writes go to legacy SQL storage.
	// The resource has not been migrated and no dual writing is active.
	StorageModeLegacy StorageMode = iota

	// StorageModeDualWrite means writes go to both legacy (primary) and unified (best effort),
	// while reads come from legacy. Unified write errors are non-blocking.
	// This is used as a preparatory step before full migration, allowing unified storage
	// to be populated and validated before switching reads.
	StorageModeDualWrite

	// StorageModeUnified means all reads and writes go to unified storage.
	// The resource has been fully migrated.
	StorageModeUnified
)

// String returns a human-readable name for the storage mode.
func (m StorageMode) String() string {
	switch m {
	case StorageModeLegacy:
		return "legacy"
	case StorageModeDualWrite:
		return "dual-write"
	case StorageModeUnified:
		return "unified"
	default:
		return "unknown"
	}
}

// MigrationStatusReader provides a way to determine the storage mode for a resource.
// This is the single source of truth for determining whether a resource should use
// legacy storage, dual-write mode, or unified storage.
//
// Resolution priority:
//  1. Config Mode1 (or Mode2/Mode3 for backward compat) → DualWrite
//  2. Migration log entry exists → Unified
//  3. Config Mode4/Mode5 → Unified (temporary fallback for cloud backfill transition)
//  4. Otherwise → Legacy
type MigrationStatusReader interface {
	GetStorageMode(ctx context.Context, gr schema.GroupResource) (StorageMode, error)
}
