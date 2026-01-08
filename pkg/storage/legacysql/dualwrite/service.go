package dualwrite

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

// fakeMigrator is a no-op implementation of UnifiedStorageMigrationService
type fakeMigrator struct{}

func (f *fakeMigrator) Run(ctx context.Context) error {
	return nil
}

var _ unifiedmigrations.UnifiedStorageMigrationService = (*fakeMigrator)(nil)

func NewFakeMigrator() unifiedmigrations.UnifiedStorageMigrationService {
	return &fakeMigrator{}
}

func NewFakeConfig() *setting.Cfg {
	return &setting.Cfg{
		UnifiedStorage: make(map[string]setting.UnifiedStorageConfig),
	}
}

func ProvideStaticServiceForTests(cfg *setting.Cfg) Service {
	if cfg == nil {
		cfg = &setting.Cfg{}
	}
	return &staticService{cfg}
}

func ProvideService(
	features featuremgmt.FeatureToggles,
	kv kvstore.KVStore,
	cfg *setting.Cfg,
	migrator unifiedmigrations.UnifiedStorageMigrationService,
) (Service, error) {
	// Ensure migrations have run before starting dualwrite
	err := migrator.Run(context.Background())
	if err != nil {
		return nil, fmt.Errorf("unable to start dualwrite service due to migration error: %w", err)
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	enabled := features.IsEnabledGlobally(featuremgmt.FlagManagedDualWriter) ||
		features.IsEnabledGlobally(featuremgmt.FlagProvisioning) // required for git provisioning

	if cfg != nil {
		if !enabled {
			return &staticService{cfg}, nil
		}

		if cfg != nil {
			foldersMode := cfg.UnifiedStorage["folders.folder.grafana.app"].DualWriterMode
			dashboardsMode := cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode

			// If both are fully on unified (Mode5), the dynamic service is not needed.
			if foldersMode == rest.Mode5 && dashboardsMode == rest.Mode5 {
				return &staticService{cfg}, nil
			}

			if (foldersMode >= rest.Mode4 || dashboardsMode >= rest.Mode4) && foldersMode != dashboardsMode {
				return nil, fmt.Errorf("dashboards and folders must use the same mode when reading from unified storage")
			}
		}
	}

	return &service{
		db: &keyvalueDB{
			db:     kv,
			logger: logging.DefaultLogger.With("logger", "dualwrite.kv"),
		},
		enabled: enabled,
	}, nil
}

type service struct {
	db      *keyvalueDB
	enabled bool
}

func (m *service) NewStorage(gr schema.GroupResource, legacy rest.Storage, unified rest.Storage) (rest.Storage, error) {
	status, err := m.Status(context.Background(), gr)
	if err != nil {
		return nil, err
	}

	if m.enabled && status.Runtime {
		// Dynamic storage behavior
		return &runtimeDualWriter{
			service:   m,
			legacy:    legacy,
			unified:   unified,
			dualwrite: &dualWriter{legacy: legacy, unified: unified}, // not used for read
			gr:        gr,
		}, nil
	}

	if status.ReadUnified {
		if status.WriteLegacy {
			// Write both, read unified
			return &dualWriter{legacy: legacy, unified: unified, readUnified: true}, nil
		}
		return unified, nil
	}
	if status.WriteUnified {
		// Write both, read legacy
		return &dualWriter{legacy: legacy, unified: unified}, nil
	}
	return legacy, nil
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
	v, ok, err := m.db.get(ctx, gr)
	return ok && v.ReadUnified, err
}

// Status implements Service.
func (m *service) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error) {
	v, found, err := m.db.get(ctx, gr)
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
		err := m.db.set(ctx, v)
		return v, err
	}
	return v, nil
}

// StartMigration implements Service.
func (m *service) StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error) {
	now := time.Now().UnixMilli()
	v, ok, err := m.db.get(ctx, gr)
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
	err = m.db.set(ctx, v)
	return v, err
}

// FinishMigration implements Service.
func (m *service) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	v, ok, err := m.db.get(ctx, schema.GroupResource{Group: status.Group, Resource: status.Resource})
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
	return status, m.db.set(ctx, status)
}
