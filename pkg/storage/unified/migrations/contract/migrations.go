package contract

import (
	"github.com/grafana/grafana/pkg/registry"
)

// UnifiedStorageMigrationService provides unified storage migrations as a background service.
// This interface is defined in a separate package to avoid import cycles between
// the migrations implementation and packages that need to depend on it (like dualwrite).
type UnifiedStorageMigrationService interface {
	registry.BackgroundService
}
