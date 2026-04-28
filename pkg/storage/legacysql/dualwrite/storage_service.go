package dualwrite

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

type storageService struct {
	cfg          *setting.Cfg
	statusReader unifiedmigrations.MigrationStatusReader
	metrics      *dualWriterMetrics
}

// getStorageMode returns the StorageMode for a resource.
// Without a statusReader or on error, the config-mode is used directly.
func (m *storageService) getStorageMode(ctx context.Context, gr schema.GroupResource) unifiedmigrations.StorageMode {
	resource := gr.String()
	if m.statusReader == nil {
		m.metrics.statusReaderNull.WithLabelValues(resource).Inc()
		return storageModeFromConfigMode(m.cfg.UnifiedStorage[resource].DualWriterMode)
	}
	mode, err := m.statusReader.GetStorageMode(ctx, gr)
	if err != nil {
		m.metrics.statusReaderErrors.WithLabelValues(resource).Inc()
		return mode
	}
	return mode
}

// storageModeToLegacyMode maps a StorageMode to a representative DualWriterMode value
// for metric consistency: Legacy→Mode0, DualWrite→Mode1, Unified→Mode5.
func storageModeToLegacyMode(mode unifiedmigrations.StorageMode) rest.DualWriterMode {
	switch mode {
	case unifiedmigrations.StorageModeUnified:
		return rest.Mode5
	case unifiedmigrations.StorageModeDualWrite:
		return rest.Mode1
	default:
		return rest.Mode0
	}
}

// NewStorage creates a storage instance based on the 3-mode concept:
//   - ModeLegacy    → return legacy
//   - ModeDualWrite → dualWriter that checks mode dynamically on every request
//   - ModeUnified   → return unified
func (m *storageService) NewStorage(gr schema.GroupResource, legacy rest.Storage, unified rest.Storage) (rest.Storage, error) {
	initialMode := m.getStorageMode(context.Background(), gr)
	m.metrics.currentMode.WithLabelValues(gr.Resource, gr.Group).Set(float64(storageModeToLegacyMode(initialMode)))

	switch initialMode {
	case unifiedmigrations.StorageModeUnified:
		return unified, nil
	case unifiedmigrations.StorageModeDualWrite:
		m.metrics.initResource(gr.String())
		return &dualWriter{
			legacy:  legacy,
			unified: unified,
			getMode: func(ctx context.Context) (bool, bool) {
				mode := m.getStorageMode(ctx, gr)
				m.metrics.currentMode.WithLabelValues(gr.Resource, gr.Group).Set(float64(storageModeToLegacyMode(mode)))
				return mode == unifiedmigrations.StorageModeUnified,
					mode == unifiedmigrations.StorageModeDualWrite
			},
			gr:      gr,
			metrics: m.metrics,
		}, nil
	default:
		return legacy, nil
	}
}

// storageModeFromConfigMode maps a DualWriterMode config value to a StorageMode.
func storageModeFromConfigMode(mode rest.DualWriterMode) unifiedmigrations.StorageMode {
	switch {
	case mode >= rest.Mode4:
		return unifiedmigrations.StorageModeUnified
	case mode >= rest.Mode1:
		return unifiedmigrations.StorageModeDualWrite
	default:
		return unifiedmigrations.StorageModeLegacy
	}
}

// ReadFromUnified implements Service.
func (m *storageService) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return m.getStorageMode(ctx, gr) == unifiedmigrations.StorageModeUnified, nil
}

// Status implements Service.
func (m *storageService) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error) {
	status := StorageStatus{
		Group:    gr.Group,
		Resource: gr.Resource,
	}
	switch m.getStorageMode(ctx, gr) {
	case unifiedmigrations.StorageModeUnified:
		status.WriteUnified = true
		status.ReadUnified = true
	case unifiedmigrations.StorageModeDualWrite:
		status.WriteLegacy = true
		status.WriteUnified = true
	default: // Legacy
		status.WriteLegacy = true
	}
	return status, nil
}

// Update implements Service.
func (m *storageService) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	return StorageStatus{}, fmt.Errorf("not implemented")
}
