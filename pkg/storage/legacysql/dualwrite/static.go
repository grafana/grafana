package dualwrite

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

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
	m := &staticService{}
	m.SetMode(gr, mode)
	return m.NewStorage(gr, legacy, unified)
}

type staticService struct {
	cfg          *setting.Cfg
	statusReader unifiedmigrations.MigrationStatusReader
	metrics      *Metrics
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

func (m *staticService) NewStorage(gr schema.GroupResource, legacy rest.Storage, unified rest.Storage) (rest.Storage, error) {
	config := m.cfg.UnifiedStorage[gr.String()]

	m.logStorageModeComparison(gr, config.DualWriterMode)

	switch config.DualWriterMode {
	case rest.Mode1:
		return &dualWriter{legacy: legacy, unified: unified, errorIsOK: true}, nil
	case rest.Mode2:
		return &dualWriter{legacy: legacy, unified: unified}, nil
	case rest.Mode3:
		return &dualWriter{legacy: legacy, unified: unified, readUnified: true}, nil
	case rest.Mode4, rest.Mode5:
		return unified, nil // use unified directly
	case rest.Mode0:
		fallthrough
	default:
		return legacy, nil
	}
}

// logStorageModeComparison logs the storage mode from MigrationStatusReader alongside the
// current config mode for observability.
func (m *staticService) logStorageModeComparison(gr schema.GroupResource, configMode rest.DualWriterMode) {
	if m.statusReader == nil {
		return
	}
	newMode, err := m.statusReader.GetStorageMode(context.Background(), gr)
	if err != nil {
		logger.Warn("Failed to get storage mode from MigrationStatusReader",
			"resource", gr.String(), "error", err)
		return
	}

	currentMode := storageModeFromConfigMode(configMode)
	if currentMode != newMode && m.metrics != nil {
		m.metrics.ModeMismatchCounter.WithLabelValues(gr.String(), currentMode.String(), newMode.String()).Inc()
	}

	logger.Info("Storage mode comparison",
		"resource", gr.String(),
		"newMode", newMode.String(),
		"currentMode", currentMode.String(),
	)
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
	config := m.cfg.UnifiedStorage[gr.String()]
	switch config.DualWriterMode {
	case rest.Mode3, rest.Mode4, rest.Mode5:
		return true, nil
	default:
		return false, nil
	}
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
		Group:       gr.Group,
		Resource:    gr.Resource,
		WriteLegacy: true,
	}
	config, ok := m.cfg.UnifiedStorage[gr.String()]
	if ok {
		switch config.DualWriterMode {
		case rest.Mode0:
			status.WriteLegacy = true
			status.WriteUnified = false
			status.ReadUnified = false
		case rest.Mode1, rest.Mode2: // only difference is that 2 will error!
			status.WriteLegacy = true
			status.WriteUnified = true
			status.ReadUnified = false
		case rest.Mode3:
			status.WriteLegacy = true
			status.WriteUnified = true
			status.ReadUnified = true
		case rest.Mode4, rest.Mode5:
			status.WriteLegacy = false
			status.WriteUnified = true
			status.ReadUnified = true
		}
	}
	return status, nil
}

// Update implements Service.
func (m *staticService) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	return StorageStatus{}, fmt.Errorf("not implemented")
}
