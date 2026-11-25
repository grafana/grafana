package dualwrite

import (
	"context"
	"fmt"
	"maps"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

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

// fakeMigrationStatusReader is a configurable implementation of MigrationStatusReader for tests.
type fakeMigrationStatusReader struct {
	modes map[string]unifiedmigrations.StorageMode
}

var _ unifiedmigrations.MigrationStatusReader = (*fakeMigrationStatusReader)(nil)

func (f *fakeMigrationStatusReader) GetStorageMode(ctx context.Context, gr schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	mode, ok := f.modes[gr.String()]
	if !ok {
		return unifiedmigrations.StorageModeLegacy, nil
	}
	return mode, nil
}

func (f *fakeMigrationStatusReader) GetFloorVersion(gr schema.GroupResource) (string, bool) {
	return "", false
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

// NewConfigBasedMigrationStatusReader creates a MigrationStatusReader that derives
// storage modes from a snapshot of the config's UnifiedStorage map, resolved like
// [setting.Cfg.UnifiedStorageConfig] (including the app plugin settings wildcard).
// This is used in standalone APIServer paths where there is no legacy database for
// migration log checks.
func NewConfigBasedMigrationStatusReader(cfg *setting.Cfg) unifiedmigrations.MigrationStatusReader {
	snapshot := &setting.Cfg{}
	if cfg != nil {
		snapshot.UnifiedStorage = maps.Clone(cfg.UnifiedStorage)
	}
	return configMigrationStatusReader{cfg: snapshot}
}

type configMigrationStatusReader struct {
	cfg *setting.Cfg
}

func (r configMigrationStatusReader) GetStorageMode(_ context.Context, gr schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	return storageModeFromConfigMode(r.cfg.UnifiedStorageConfig(gr.String()).DualWriterMode), nil
}

func (configMigrationStatusReader) GetFloorVersion(schema.GroupResource) (string, bool) {
	return "", false
}

func NewFakeConfig() *setting.Cfg {
	return &setting.Cfg{
		UnifiedStorage: make(map[string]setting.UnifiedStorageConfig),
	}
}

func ProvideServiceForTests(cfg *setting.Cfg) Service {
	if cfg == nil {
		cfg = &setting.Cfg{}
	}
	return &storageService{cfg: cfg, metrics: provideDualWriterMetrics(prometheus.NewRegistry())}
}

func ProvideService(
	cfg *setting.Cfg,
	migrator unifiedmigrations.UnifiedStorageMigrationService,
	statusReader unifiedmigrations.MigrationStatusReader,
	reg prometheus.Registerer,
) (Service, error) {
	// Ensure migrations have run before starting dualwrite
	err := migrator.Run(context.Background())
	if err != nil {
		return nil, fmt.Errorf("unable to start dualwrite service due to migration error: %w", err)
	}

	if cfg == nil {
		cfg = &setting.Cfg{}
	}

	metrics := provideDualWriterMetrics(reg)
	return &storageService{cfg: cfg, statusReader: statusReader, metrics: metrics}, nil
}
