package frontend

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestFSRequestConfig_ApplyOverrides(t *testing.T) {
	t.Run("should handle empty ini file", func(t *testing.T) {
		config := FSRequestConfig{
			AppURL:     "https://base.example.com",
			CSPEnabled: true,
		}

		iniFile := ini.Empty()

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, "https://base.example.com", config.AppURL)
		assert.Equal(t, true, config.CSPEnabled)
	})

	t.Run("should preserve non-overridden fields", func(t *testing.T) {
		config := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				AnonymousEnabled: true,
				DisableLoginForm: true,
				LoginHint:        "test@example.com",
				BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
					Version: "10.3.0",
				},
			},
			AppURL:     "https://base.example.com",
			CSPEnabled: false,
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("allow_embedding_hosts", "foo.example.com")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		// CSP overridden field
		assert.Equal(t, []string{"foo.example.com"}, config.AllowEmbeddingHosts)

		// Non-overridden fields should be preserved
		assert.Equal(t, "https://base.example.com", config.AppURL)
		assert.True(t, config.AnonymousEnabled)
		assert.True(t, config.DisableLoginForm)
		assert.Equal(t, "test@example.com", config.LoginHint)
		assert.Equal(t, "10.3.0", config.BuildInfo.Version)
	})

	t.Run("should override FSFrontendSettings fields from settings service", func(t *testing.T) {
		config := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				RudderstackWriteKey:     "base-write-key",
				RudderstackDataPlaneUrl: "https://base-dataplane.example.com",
			},
		}

		iniFile := ini.Empty()
		analyticsSection, _ := iniFile.NewSection("analytics")
		_, _ = analyticsSection.NewKey("rudderstack_write_key", "tenant-write-key")
		_, _ = analyticsSection.NewKey("rudderstack_data_plane_url", "https://tenant-dataplane.example.com")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, "tenant-write-key", config.RudderstackWriteKey)
		assert.Equal(t, "https://tenant-dataplane.example.com", config.RudderstackDataPlaneUrl)
	})

	t.Run("should override allow_embedding_hosts from settings service", func(t *testing.T) {
		config := FSRequestConfig{
			AllowEmbeddingHosts: nil,
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("allow_embedding_hosts", "wiki.example.com foo.example.com")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, []string{"wiki.example.com", "foo.example.com"}, config.AllowEmbeddingHosts)
	})

	t.Run("should override allow_embedding_hosts with wildcard from settings service", func(t *testing.T) {
		config := FSRequestConfig{
			AllowEmbeddingHosts: nil,
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("allow_embedding_hosts", "*")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, []string{"*"}, config.AllowEmbeddingHosts)
	})

	t.Run("should override form_action_additional_hosts from settings service", func(t *testing.T) {
		config := FSRequestConfig{
			FormActionAdditionalHosts: nil,
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("form_action_additional_hosts", "login.example.com auth.example.com")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, []string{"login.example.com", "auth.example.com"}, config.FormActionAdditionalHosts)
	})

	t.Run("should override form_action_additional_hosts with wildcard from settings service", func(t *testing.T) {
		config := FSRequestConfig{
			FormActionAdditionalHosts: nil,
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("form_action_additional_hosts", "*")

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, []string{"*"}, config.FormActionAdditionalHosts)
	})

	t.Run("should preserve form_action_additional_hosts when not overridden", func(t *testing.T) {
		config := FSRequestConfig{
			FormActionAdditionalHosts: []string{"base.example.com"},
		}

		iniFile := ini.Empty()

		config.ApplyOverrides(iniFile, log.New("test"), false)

		assert.Equal(t, []string{"base.example.com"}, config.FormActionAdditionalHosts)
	})

	t.Run("with full frontend settings enabled, applies rudderstack overrides to FullFrontendSettings", func(t *testing.T) {
		config := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				RudderstackWriteKey: "legacy-write-key",
			},
			FullFrontendSettings: &dtos.FrontendSettingsDTO{
				RudderstackWriteKey:     "base-write-key",
				RudderstackDataPlaneUrl: "https://base-dataplane.example.com",
			},
		}

		iniFile := ini.Empty()
		analyticsSection, _ := iniFile.NewSection("analytics")
		_, _ = analyticsSection.NewKey("rudderstack_write_key", "tenant-write-key")
		_, _ = analyticsSection.NewKey("rudderstack_data_plane_url", "https://tenant-dataplane.example.com")

		config.ApplyOverrides(iniFile, log.New("test"), true)

		// Overrides land on the full settings object when the flag is enabled.
		assert.Equal(t, "tenant-write-key", config.FullFrontendSettings.RudderstackWriteKey)
		assert.Equal(t, "https://tenant-dataplane.example.com", config.FullFrontendSettings.RudderstackDataPlaneUrl)

		// The legacy FSFrontendSettings field is left untouched when the flag is enabled.
		assert.Equal(t, "legacy-write-key", config.RudderstackWriteKey)
	})

	// When the flag is enabled the middleware always builds FullFrontendSettings before
	// calling ApplyOverrides, so the nil case should not happen in production. The nil
	// guard ensures we degrade gracefully (skip the analytics overrides) rather than
	// panicking on a nil dereference if that invariant is ever broken.
	t.Run("with full frontend settings enabled but nil FullFrontendSettings, skips overrides without panicking", func(t *testing.T) {
		config := FSRequestConfig{}

		iniFile := ini.Empty()
		analyticsSection, _ := iniFile.NewSection("analytics")
		_, _ = analyticsSection.NewKey("rudderstack_write_key", "tenant-write-key")

		require.NotPanics(t, func() {
			config.ApplyOverrides(iniFile, log.New("test"), true)
		})

		assert.Nil(t, config.FullFrontendSettings)
	})
}

func TestNewFSRequestConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.AppURL = "https://grafana.example.com"
		return cfg
	}

	newPluginsCDN := func() *pluginscdn.Service {
		return pluginscdn.ProvideService(&config.PluginManagementCfg{
			PluginsCDNURLTemplate: "https://cdn.example.com",
		})
	}

	t.Run("does not build full frontend settings when flag disabled", func(t *testing.T) {
		cfg := newCfg()
		license := &licensing.OSSLicensingService{Cfg: cfg}

		config, err := NewFSRequestConfig(context.Background(), cfg, license, newPluginsCDN(), false)
		require.NoError(t, err)

		assert.Nil(t, config.FullFrontendSettings)
		// The legacy per-request settings are still populated.
		assert.Equal(t, "https://grafana.example.com", config.AppURL)
	})

	t.Run("builds full frontend settings when flag enabled", func(t *testing.T) {
		cfg := newCfg()
		license := &licensing.OSSLicensingService{Cfg: cfg}

		reqCtx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest("GET", "/", nil)},
			SignedInUser: &user.SignedInUser{},
			Logger:       log.NewNopLogger(),
		}
		ctx := ctxkey.Set(context.Background(), reqCtx)

		config, err := NewFSRequestConfig(ctx, cfg, license, newPluginsCDN(), true)
		require.NoError(t, err)

		require.NotNil(t, config.FullFrontendSettings)
		assert.Equal(t, "https://grafana.example.com", config.FullFrontendSettings.AppUrl)
		// The plugins CDN base URL is sourced from the plugins CDN service.
		assert.Equal(t, "https://cdn.example.com", config.FullFrontendSettings.PluginsCDNBaseURL)
	})
}
