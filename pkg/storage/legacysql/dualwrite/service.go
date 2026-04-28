package dualwrite

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"

	"github.com/grafana/grafana/pkg/setting"
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
// storage modes from the config's UnifiedStorage map. This is used in standalone
// APIServer paths where there is no legacy database for migration log checks.
func NewConfigBasedMigrationStatusReader(cfg *setting.Cfg) unifiedmigrations.MigrationStatusReader {
	m := make(map[string]unifiedmigrations.StorageMode)
	if cfg != nil {
		for key, config := range cfg.UnifiedStorage {
			m[key] = storageModeFromConfigMode(config.DualWriterMode)
		}
	}
	return &fakeMigrationStatusReader{modes: m}
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
