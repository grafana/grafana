package frontend

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
)

func TestFSRequestConfig_ApplyOverrides(t *testing.T) {
	t.Run("should handle empty ini file", func(t *testing.T) {
		config := FSRequestConfig{
			AppURL:     "https://base.example.com",
			CSPEnabled: true,
		}

		iniFile := ini.Empty()

		config.ApplyOverrides(iniFile, log.New("test"))

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
		_, _ = securitySection.NewKey("content_security_policy", "true")

		config.ApplyOverrides(iniFile, log.New("test"))

		// CSP overridden field
		assert.True(t, config.CSPEnabled)

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

		config.ApplyOverrides(iniFile, log.New("test"))

		assert.Equal(t, "tenant-write-key", config.RudderstackWriteKey)
		assert.Equal(t, "https://tenant-dataplane.example.com", config.RudderstackDataPlaneUrl)
	})

	t.Run("should apply multiple CSP overrides at once", func(t *testing.T) {
		config := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				AnonymousEnabled:  false,
				DisableLoginForm:  false,
				DisableUserSignUp: false,
			},
			AppURL:                "https://base.example.com",
			CSPEnabled:            false,
			CSPTemplate:           "",
			CSPReportOnlyEnabled:  false,
			CSPReportOnlyTemplate: "",
		}

		iniFile := ini.Empty()

		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("content_security_policy", "true")
		_, _ = securitySection.NewKey("content_security_policy_template", "script-src 'self'")
		_, _ = securitySection.NewKey("content_security_policy_report_only", "true")
		_, _ = securitySection.NewKey("content_security_policy_report_only_template", "default-src 'none'")

		config.ApplyOverrides(iniFile, log.New("test"))

		// All CSP settings should be overridden
		assert.True(t, config.CSPEnabled)
		assert.Equal(t, "script-src 'self'", config.CSPTemplate)
		assert.True(t, config.CSPReportOnlyEnabled)
		assert.Equal(t, "default-src 'none'", config.CSPReportOnlyTemplate)

		// Other settings should remain unchanged
		assert.Equal(t, "https://base.example.com", config.AppURL)
		assert.False(t, config.DisableLoginForm)
		assert.False(t, config.AnonymousEnabled)
	})
}
