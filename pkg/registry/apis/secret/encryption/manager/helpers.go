package manager

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
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
			[security]
			secret_key = ` + defaultKey + `
	
			[security.encryption]
			data_keys_cache_ttl = 5m
			data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(tb, err)

	cfg := &setting.Cfg{Raw: raw}
	store, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(tb, err)

	encProvider := encryptionprovider.Provider{}
	usageStats := &usagestats.UsageStatsMock{T: tb}

	encryption, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
	require.NoError(tb, err)

	encMgr, err := NewEncryptionManager(
		tracing.InitializeTracerForTest(),
		store,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		cfg,
		usageStats,
	)
	require.NoError(tb, err)

	return encMgr
}
