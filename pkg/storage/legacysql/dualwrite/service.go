package dualwrite

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(features featuremgmt.FeatureToggles, reg prometheus.Registerer, cfg *setting.Cfg) Service {
	enabled := features.IsEnabledGlobally(featuremgmt.FlagManagedDualWriter) ||
		features.IsEnabledGlobally(featuremgmt.FlagProvisioning) // required for git provisioning
	if !enabled && cfg != nil {
		return &staticService{cfg} // fallback to using the dual write flags from cfg
	}

	path := "" // storage path
	if cfg != nil {
		path = filepath.Join(cfg.DataPath, "dualwrite.json")
	}

	return &service{
		db:      newFileDB(path),
		reg:     reg,
		enabled: enabled,
	}
}

type service struct {
	db      statusStorage
	reg     prometheus.Registerer
	enabled bool
}

// The storage interface has zero business logic and simply writes values to a database
type statusStorage interface {
	Get(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool, error)
	Set(ctx context.Context, status StorageStatus) error
}

// Hardcoded list of resources that should be controlled by the database (eventually everything?)
func (m *service) ShouldManage(gr schema.GroupResource) bool {
	if !m.enabled {
		return false
	}
	switch gr.String() {
	case "folders.folder.grafana.app":
		return true
	case "dashboards.dashboard.grafana.app":
		return true
	}
	return false
}

func (m *service) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	v, ok, err := m.db.Get(ctx, gr)
	return ok && v.ReadUnified, err
}

// Status implements Service.
func (m *service) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error) {
	v, found, err := m.db.Get(ctx, gr)
	if err != nil {
		return v, err
	}
	if !found {
		v = StorageStatus{
			Group:        gr.Group,
			Resource:     gr.Resource,
			WriteLegacy:  true,
			WriteUnified: true, // Write both, but read legacy
			ReadUnified:  false,
			Migrated:     0,
			Migrating:    0,
			Runtime:      true, // need to explicitly ask for not runtime
			UpdateKey:    1,
		}
		err := m.db.Set(ctx, v)
		return v, err
	}
	return v, nil
}

// StartMigration implements Service.
func (m *service) StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error) {
	now := time.Now().UnixMilli()
	v, ok, err := m.db.Get(ctx, gr)
	if err != nil {
		return v, err
	}
	if ok {
		if v.Migrated > 0 {
			return v, fmt.Errorf("already migrated")
		}
		if key != v.UpdateKey {
			return v, fmt.Errorf("migration key mismatch")
		}
		if v.Migrating > 0 {
			return v, fmt.Errorf("migration in progress")
		}

		v.Migrating = now
		v.UpdateKey++
	} else {
		v = StorageStatus{
			Group:        gr.Group,
			Resource:     gr.Resource,
			Runtime:      true,
			WriteLegacy:  true,
			WriteUnified: true,
			ReadUnified:  false,
			Migrating:    now,
			Migrated:     0, // timestamp
			UpdateKey:    1,
		}
	}
	err = m.db.Set(ctx, v)
	return v, err
}

// FinishMigration implements Service.
func (m *service) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	v, ok, err := m.db.Get(ctx, schema.GroupResource{Group: status.Group, Resource: status.Resource})
	if err != nil {
		return v, err
	}
	if !ok {
		return v, fmt.Errorf("unable to update status that is not yet saved")
	}
	if status.UpdateKey != v.UpdateKey {
		return v, fmt.Errorf("key mismatch (resource: %s, expected:%d, received: %d)", v.Resource, v.UpdateKey, status.UpdateKey)
	}
	if status.Migrating > 0 {
		return v, fmt.Errorf("update can not change migrating status")
	}
	if status.ReadUnified {
		if status.Migrated == 0 {
			return v, fmt.Errorf("can not read from unified before a migration")
		}
		if !status.WriteUnified {
			return v, fmt.Errorf("must write to unified when reading from unified")
		}
	}
	if !status.WriteLegacy && !status.WriteUnified {
		return v, fmt.Errorf("must write either legacy or unified")
	}
	status.UpdateKey++
	return status, m.db.Set(ctx, status)
}
