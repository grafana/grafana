package frontend

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
)

func TestFSRequestConfig_Copy(t *testing.T) {
	t.Run("should deep copy ReportingStaticContext map", func(t *testing.T) {
		original := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				ReportingStaticContext: map[string]string{
					"key1": "value1",
					"key2": "value2",
				},
				AnonymousEnabled: true,
			},
			CSPEnabled: true,
			AppURL:     "https://example.com",
		}

		copied := original.Copy()

		// Modify the copied map
		copied.ReportingStaticContext["key1"] = "modified"
		copied.ReportingStaticContext["key3"] = "new"

		// Original should be unchanged
		assert.Equal(t, "value1", original.ReportingStaticContext["key1"])
		assert.NotContains(t, original.ReportingStaticContext, "key3")

		// Copied should have modifications
		assert.Equal(t, "modified", copied.ReportingStaticContext["key1"])
		assert.Equal(t, "new", copied.ReportingStaticContext["key3"])
	})

	t.Run("should handle nil map", func(t *testing.T) {
		original := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				ReportingStaticContext: nil,
			},
		}

		copied := original.Copy()

		assert.Nil(t, copied.ReportingStaticContext)
	})

	t.Run("should copy primitive fields", func(t *testing.T) {
		original := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				AnonymousEnabled: true,
				DisableLoginForm: true,
				LoginHint:        "test@example.com",
				BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
					Version: "10.3.0",
					Edition: "Enterprise",
				},
			},
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://example.com",
		}

		copied := original.Copy()

		assert.Equal(t, original.AnonymousEnabled, copied.AnonymousEnabled)
		assert.Equal(t, original.DisableLoginForm, copied.DisableLoginForm)
		assert.Equal(t, original.LoginHint, copied.LoginHint)
		assert.Equal(t, original.BuildInfo.Version, copied.BuildInfo.Version)
		assert.Equal(t, original.BuildInfo.Edition, copied.BuildInfo.Edition)
		assert.Equal(t, original.CSPEnabled, copied.CSPEnabled)
		assert.Equal(t, original.CSPTemplate, copied.CSPTemplate)
		assert.Equal(t, original.AppURL, copied.AppURL)
	})
}

func TestFSRequestConfig_ApplyOverrides(t *testing.T) {
	t.Run("should handle empty ini file", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			AppURL:     "https://base.example.com",
			CSPEnabled: true,
		}

		iniFile := ini.Empty()

		result := baseConfig.WithOverrides(iniFile, log.New("test"))

		assert.Equal(t, baseConfig.AppURL, result.AppURL)
		assert.Equal(t, baseConfig.CSPEnabled, result.CSPEnabled)
	})

	t.Run("should preserve non-overridden fields", func(t *testing.T) {
		baseConfig := FSRequestConfig{
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

		result := baseConfig.WithOverrides(iniFile, log.New("test"))

		// CSP overridden field
		assert.True(t, result.CSPEnabled)

		// Non-overridden fields should be preserved
		assert.Equal(t, "https://base.example.com", result.AppURL)
		assert.True(t, result.AnonymousEnabled)
		assert.True(t, result.DisableLoginForm)
		assert.Equal(t, "test@example.com", result.LoginHint)
		assert.Equal(t, "10.3.0", result.BuildInfo.Version)
	})

	t.Run("should deep copy map to avoid shared references", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				ReportingStaticContext: map[string]string{
					"original": "value",
				},
			},
		}

		iniFile := ini.Empty()
		securitySection, _ := iniFile.NewSection("security")
		_, _ = securitySection.NewKey("content_security_policy", "true")

		result := baseConfig.WithOverrides(iniFile, log.New("test"))

		// Modify the result's map
		result.ReportingStaticContext["new"] = "value"

		// Original should be unaffected
		assert.NotContains(t, baseConfig.ReportingStaticContext, "new")
		assert.Equal(t, 1, len(baseConfig.ReportingStaticContext))
	})

	t.Run("should apply multiple CSP overrides at once", func(t *testing.T) {
		baseConfig := FSRequestConfig{
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

		result := baseConfig.WithOverrides(iniFile, log.New("test"))

		// All CSP settings should be overridden
		assert.True(t, result.CSPEnabled)
		assert.Equal(t, "script-src 'self'", result.CSPTemplate)
		assert.True(t, result.CSPReportOnlyEnabled)
		assert.Equal(t, "default-src 'none'", result.CSPReportOnlyTemplate)

		// Other settings should remain unchanged
		assert.Equal(t, "https://base.example.com", result.AppURL)
		assert.False(t, result.DisableLoginForm)
		assert.False(t, result.AnonymousEnabled)
	})
}
