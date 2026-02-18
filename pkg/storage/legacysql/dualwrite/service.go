package dualwrite

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

var logger = log.New("dualwrite.service")

// fakeMigrator is a no-op implementation of UnifiedStorageMigrationService
type fakeMigrator struct{}

func (f *fakeMigrator) Run(ctx context.Context) error {
	return nil
}

var _ unifiedmigrations.UnifiedStorageMigrationService = (*fakeMigrator)(nil)

func NewFakeMigrator() unifiedmigrations.UnifiedStorageMigrationService {
	return &fakeMigrator{}
}

// fakeMigrationStatusReader is a configurable implementation of MigrationStatusReader for tests.
type fakeMigrationStatusReader struct {
	modes map[string]unifiedmigrations.StorageMode
}

var _ unifiedmigrations.MigrationStatusReader = (*fakeMigrationStatusReader)(nil)

func (f *fakeMigrationStatusReader) GetStorageMode(_ context.Context, gr schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	mode, ok := f.modes[gr.String()]
	if !ok {
		return unifiedmigrations.StorageModeLegacy, nil
	}
	return mode, nil
}

// NewFakeMigrationStatusReader creates a MigrationStatusReader for tests.
// Accepts pairs of (GroupResource string, StorageMode). Resources not listed default to Legacy.
// Example: NewFakeMigrationStatusReader("dashboards.dashboard.grafana.app", contract.StorageModeUnified)
func NewFakeMigrationStatusReader(resourceModes ...interface{}) unifiedmigrations.MigrationStatusReader {
	m := make(map[string]unifiedmigrations.StorageMode)
	for i := 0; i+1 < len(resourceModes); i += 2 {
		key, _ := resourceModes[i].(string)
		mode, _ := resourceModes[i+1].(unifiedmigrations.StorageMode)
		m[key] = mode
	}
	return &fakeMigrationStatusReader{modes: m}
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
	return &staticService{cfg: cfg}
}

func ProvideService(
	features featuremgmt.FeatureToggles,
	kv kvstore.KVStore,
	cfg *setting.Cfg,
	migrator unifiedmigrations.UnifiedStorageMigrationService,
	statusReader unifiedmigrations.MigrationStatusReader,
	metrics *Metrics,
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
			return &staticService{cfg: cfg, statusReader: statusReader, metrics: metrics}, nil
		}

		if cfg != nil {
			foldersMode := cfg.UnifiedStorage["folders.folder.grafana.app"].DualWriterMode
			dashboardsMode := cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode

			// If both are fully on unified (Mode5), the dynamic service is not needed.
			if foldersMode == rest.Mode5 && dashboardsMode == rest.Mode5 {
				return &staticService{cfg: cfg, statusReader: statusReader, metrics: metrics}, nil
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
		enabled:      enabled,
		statusReader: statusReader,
		metrics:      metrics,
	}, nil
}

type service struct {
	db           *keyvalueDB
	enabled      bool
	statusReader unifiedmigrations.MigrationStatusReader
	metrics      *Metrics
}

func (m *service) NewStorage(gr schema.GroupResource, legacy rest.Storage, unified rest.Storage) (rest.Storage, error) {
	status, err := m.Status(context.Background(), gr)
	if err != nil {
		return nil, err
	}

	m.logStorageModeComparison(gr, status)

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

// logStorageModeComparison logs the storage mode from MigrationStatusReader alongside the
// current status for observability. This allows validating that the new mode determination
// agrees with the existing behavior before switching over in a future PR.
func (m *service) logStorageModeComparison(gr schema.GroupResource, status StorageStatus) {
	if m.statusReader == nil {
		return
	}
	newMode, err := m.statusReader.GetStorageMode(context.Background(), gr)
	if err != nil {
		logger.Warn("Failed to get storage mode from MigrationStatusReader",
			"resource", gr.String(), "error", err)
		return
	}

	currentMode := storageModeFromStatus(status)
	if currentMode != newMode && m.metrics != nil {
		m.metrics.ModeMismatchCounter.WithLabelValues(gr.String(), currentMode.String(), newMode.String()).Inc()
	}

	logger.Info("Storage mode comparison",
		"resource", gr.String(),
		"newMode", newMode.String(),
		"currentMode", currentMode.String(),
	)
}

// storageModeFromStatus derives a StorageMode from the current StorageStatus.
func storageModeFromStatus(status StorageStatus) unifiedmigrations.StorageMode {
	if status.ReadUnified && status.WriteUnified && !status.WriteLegacy {
		return unifiedmigrations.StorageModeUnified
	}
	if status.WriteUnified {
		return unifiedmigrations.StorageModeDualWrite
	}
	return unifiedmigrations.StorageModeLegacy
}
