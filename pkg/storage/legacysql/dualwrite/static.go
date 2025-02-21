package dualwrite

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
)

type staticService struct {
	cfg *setting.Cfg
}

func (m *staticService) NewStorage(gr schema.GroupResource, legacy rest.LegacyStorage, storage rest.Storage) (rest.Storage, error) {
	return nil, fmt.Errorf("not implemented")
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
