package manager

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret"
)

func SetupTestService(tb testing.TB, store secret.DataKeyStorage) *EncryptionManager {
	return setupTestService(tb, store, featuremgmt.WithFeatures())
}

func SetupDisabledTestService(tb testing.TB, store secret.DataKeyStorage) *EncryptionManager {
	return setupTestService(tb, store, featuremgmt.WithFeatures(featuremgmt.FlagDisableEnvelopeEncryption))
}

func setupTestService(tb testing.TB, store secret.DataKeyStorage, features featuremgmt.FeatureToggles) *EncryptionManager {
	tb.Helper()
	defaultKey := "SdlklWklckeLS"
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey + `

		[security.encryption]
		data_keys_cache_ttl = 5m
		data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(tb, err)

	cfg := &setting.Cfg{Raw: raw}

	encProvider := encryptionprovider.Provider{}
	usageStats := &usagestats.UsageStatsMock{}

	encryption, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
	require.NoError(tb, err)

	encMgr, err := NewEncryptionManager(
		tracing.InitializeTracerForTest(),
		store,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		cfg,
		&usagestats.UsageStatsMock{T: tb},
	)
	require.NoError(tb, err)

	return encMgr
}
