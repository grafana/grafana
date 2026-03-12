package dualwrite

import (
	"context"
	"fmt"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

// NewStaticStorage -- temporary shim
func NewStaticStorage(
	gr schema.GroupResource,
	mode rest.DualWriterMode,
	legacy rest.Storage,
	unified rest.Storage,
) (rest.Storage, error) {
	m := &staticService{metrics: provideDualWriterMetrics(prometheus.NewRegistry())}
	m.SetMode(gr, mode)
	return m.NewStorage(gr, legacy, unified)
}

type staticService struct {
	cfg          *setting.Cfg
	statusReader unifiedmigrations.MigrationStatusReader
	metrics      *dualWriterMetrics

	// resourceModesCache holds the resolved StorageMode per resource
	resourceModesCache sync.Map // map[string]unifiedmigrations.StorageMode
}

// Used in tests
func (m *staticService) SetMode(gr schema.GroupResource, mode rest.DualWriterMode) {
	if m.cfg == nil {
		m.cfg = &setting.Cfg{}
	}
	if m.cfg.UnifiedStorage == nil {
		m.cfg.UnifiedStorage = make(map[string]setting.UnifiedStorageConfig)
	}
	m.cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{
		DualWriterMode: mode,
	}
}

// getStorageMode returns the StorageMode for a resource.
//
// When a MigrationStatusReader is available the result is cached.
// Without a statusReader (tests via NewStaticStorage) the config-mode.
func (m *staticService) getStorageMode(ctx context.Context, gr schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	if m.statusReader == nil {
		config := m.cfg.UnifiedStorage[gr.String()]
		return storageModeFromConfigMode(config.DualWriterMode), nil
	}

	key := gr.String()

	if val, ok := m.resourceModesCache.Load(key); ok {
		return val.(unifiedmigrations.StorageMode), nil
	}

	// Resolve once from the MigrationStatusReader.
	mode, err := m.statusReader.GetStorageMode(ctx, gr)
	if err != nil {
		return unifiedmigrations.StorageModeLegacy, err
	}
	m.resourceModesCache.Store(key, mode)

	logging.DefaultLogger.With("resource", key, "mode", mode).Info("resolved static storage mode")
	return mode, nil
}

// NewStorage creates a storage instance based on the 3-mode concept:
//   - ModeLegacy    → return legacy
//   - ModeDualWrite → best-effort dual write, read from legacy (Mode1 behaviour)
//   - ModeUnified   → return unified
func (m *staticService) NewStorage(gr schema.GroupResource, legacy rest.Storage, unified rest.Storage) (rest.Storage, error) {
	mode, err := m.getStorageMode(context.Background(), gr)
	if err != nil {
		return nil, err
	}

	switch mode {
	case unifiedmigrations.StorageModeUnified:
		return unified, nil
	case unifiedmigrations.StorageModeDualWrite:
		m.metrics.initResource(gr.String())
		return &dualWriter{legacy: legacy, unified: unified, errorIsOK: true, gr: gr, metrics: m.metrics}, nil
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
func (m *staticService) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	mode, err := m.getStorageMode(ctx, gr)
	if err != nil {
		return false, err
	}
	return mode == unifiedmigrations.StorageModeUnified, nil
}

// ShouldManage implements Service.
func (m *staticService) ShouldManage(gr schema.GroupResource) bool {
	return false
}

// StartMigration implements Service.
func (m *staticService) StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error) {
	return StorageStatus{}, fmt.Errorf("not implemented")
}

// Status implements Service.
func (m *staticService) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error) {
	status := StorageStatus{
		Group:    gr.Group,
		Resource: gr.Resource,
	}
	mode, err := m.getStorageMode(ctx, gr)
	if err != nil {
		return status, err
	}

	switch mode {
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
func (m *staticService) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	return StorageStatus{}, fmt.Errorf("not implemented")
}
