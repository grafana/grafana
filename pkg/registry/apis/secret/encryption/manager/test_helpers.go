package manager

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

func setupTestService(tb testing.TB) *EncryptionManager {
	tb.Helper()

	// Initialize data key storage with a fake db
	testDB := db.InitTestDB(tb)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	defaultKey := "SdlklWklckeLS"
	raw, err := ini.Load([]byte(`
			[secrets_manager]
			secret_key = ` + defaultKey + `
	
			[secrets_manager.encryption]
			data_keys_cache_ttl = 5m
			data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(tb, err)

	cfg := &setting.Cfg{
		Raw: raw,
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          defaultKey,
			EncryptionProvider: "secretKey.v1",
			AvailableProviders: []string{"secretKey.v1"},
			Encryption: setting.EncryptionSettings{
				DataKeysCleanupInterval: time.Nanosecond,
			},
		},
	}
	store, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(tb, err)

	usageStats := &usagestats.UsageStatsMock{T: tb}

	encMgr, err := ProvideEncryptionManager(
		tracing.InitializeTracerForTest(),
		store,
		cfg,
		usageStats,
	)
	require.NoError(tb, err)

	return encMgr
}
