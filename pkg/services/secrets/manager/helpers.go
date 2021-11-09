package manager

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gopkg.in/ini.v1"
)

func SetupTestService(tb testing.TB, store secrets.Store) *SecretsService {
	tb.Helper()
	defaultKey := "SdlklWklckeLS"
	if len(setting.SecretKey) > 0 {
		defaultKey = setting.SecretKey
	}
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey))
	require.NoError(tb, err)
	cfg := &setting.Cfg{Raw: raw}
	cfg.FeatureToggles = map[string]bool{envelopeEncryptionFeatureToggle: true}

	settings := &setting.OSSImpl{Cfg: cfg}
	assert.True(tb, settings.IsFeatureToggleEnabled(envelopeEncryptionFeatureToggle))

	return ProvideSecretsService(
		store,
		ossencryption.ProvideService(),
		settings,
	)
}
