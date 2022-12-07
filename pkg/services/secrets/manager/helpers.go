package manager

import (
	"testing"

	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func SetupTestService(tb testing.TB, store secrets.Store) *SecretsService {
	return setupTestService(tb, store, featuremgmt.WithFeatures())
}

func SetupDisabledTestService(tb testing.TB, store secrets.Store) *SecretsService {
	return setupTestService(tb, store, featuremgmt.WithFeatures(featuremgmt.FlagDisableEnvelopeEncryption))
}

func setupTestService(tb testing.TB, store secrets.Store, features *featuremgmt.FeatureManager) *SecretsService {
	tb.Helper()
	defaultKey := "SdlklWklckeLS"
	if len(setting.SecretKey) > 0 {
		defaultKey = setting.SecretKey
	}
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey + `

		[security.encryption]
		data_keys_cache_ttl = 5m
		data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(tb, err)

	cfg := &setting.Cfg{Raw: raw}

	encProvider := encryptionprovider.Provider{}

	encryption, err := encryptionservice.ProvideEncryptionService(encProvider, cfg)
	require.NoError(tb, err)

	secretsService, err := ProvideSecretsService(
		store,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		features,
		cfg,
	)
	require.NoError(tb, err)

	return secretsService
}
