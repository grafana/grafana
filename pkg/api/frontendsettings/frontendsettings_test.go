package frontendsettings

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func newTestReqContext() *contextmodel.ReqContext {
	return &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{},
	}
}

func TestGetBaseFrontendSettings(t *testing.T) {
	t.Run("returns settings without error for a default config", func(t *testing.T) {
		cfg := setting.NewCfg()
		license := &licensing.OSSLicensingService{Cfg: cfg}

		settings, err := GetBaseFrontendSettings(newTestReqContext(), cfg, license)
		require.NoError(t, err)
		require.NotNil(t, settings)

		// Maps should be initialised so callers can safely populate them.
		assert.NotNil(t, settings.Datasources)
		assert.NotNil(t, settings.Panels)
		assert.NotNil(t, settings.Apps)
		assert.NotNil(t, settings.FeatureToggles)

		// The default datasource sentinel is set here and overridden by callers.
		assert.Equal(t, "-- Grafana --", settings.DefaultDatasource)

		// RbacEnabled and LiveNamespaced are always true.
		assert.True(t, settings.RbacEnabled)
		assert.True(t, settings.LiveNamespaced)
	})

	t.Run("maps values from config", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AppURL = "https://grafana.example.com/"
		cfg.AppSubURL = "/grafana"
		cfg.Anonymous.Enabled = true

		license := &licensing.OSSLicensingService{Cfg: cfg}

		settings, err := GetBaseFrontendSettings(newTestReqContext(), cfg, license)
		require.NoError(t, err)
		require.NotNil(t, settings)

		assert.Equal(t, "https://grafana.example.com/", settings.AppUrl)
		assert.Equal(t, "/grafana", settings.AppSubUrl)
		assert.True(t, settings.AnonymousEnabled)
	})

	t.Run("enables trusted types policy when CSP template requires it", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "require-trusted-types-for 'script';"

		license := &licensing.OSSLicensingService{Cfg: cfg}

		settings, err := GetBaseFrontendSettings(newTestReqContext(), cfg, license)
		require.NoError(t, err)
		assert.True(t, settings.TrustedTypesDefaultPolicyEnabled)
	})

	t.Run("populates unified alerting state history when enabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.UnifiedAlerting.StateHistory.Enabled = true
		cfg.UnifiedAlerting.StateHistory.Backend = "loki"

		license := &licensing.OSSLicensingService{Cfg: cfg}

		settings, err := GetBaseFrontendSettings(newTestReqContext(), cfg, license)
		require.NoError(t, err)
		require.NotNil(t, settings.UnifiedAlerting.StateHistory)
		assert.Equal(t, "loki", settings.UnifiedAlerting.StateHistory.Backend)
		assert.Equal(t, "loki", settings.UnifiedAlerting.AlertStateHistoryBackend)
	})
}
