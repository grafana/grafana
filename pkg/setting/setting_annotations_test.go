package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLoadAnnotationAppPlatformSettings(t *testing.T) {
	t.Run("MaxScopeCount", func(t *testing.T) {
		cases := []struct {
			name                  string
			iniValue              *string // nil means no key set
			expectedMaxScopeCount int
			expectErr             bool
		}{
			{name: "default when key absent", expectedMaxScopeCount: 5},
			{name: "explicit positive", iniValue: new("10"), expectedMaxScopeCount: 10},
			{name: "zero is accepted", iniValue: new("0"), expectedMaxScopeCount: 0},
			{name: "negative is rejected", iniValue: new("-1"), expectErr: true},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				iniFile := ini.Empty()
				if tc.iniValue != nil {
					section, err := iniFile.NewSection("annotations.app_platform")
					require.NoError(t, err)

					_, err = section.NewKey("max_scope_count", *tc.iniValue)
					require.NoError(t, err)
				}

				settings, err := loadAnnotationAppPlatformSettings(&Cfg{Raw: iniFile})
				if tc.expectErr {
					assert.Error(t, err)
					return
				}

				require.NoError(t, err)
				assert.Equal(t, tc.expectedMaxScopeCount, settings.MaxScopeCount)
			})
		}
	})

	t.Run("RetentionTTL", func(t *testing.T) {
		cases := []struct {
			name        string
			iniValue    *string
			expectedTTL time.Duration
			expectErr   bool
		}{
			{name: "default when key absent is disabled", expectedTTL: 0},
			{name: "empty value is disabled", iniValue: new(""), expectedTTL: 0},
			{name: "zero is disabled", iniValue: new("0"), expectedTTL: 0},
			{name: "explicit positive", iniValue: new("2160h"), expectedTTL: 2160 * time.Hour},
			{name: "negative is rejected", iniValue: new("-1h"), expectErr: true},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				iniFile := ini.Empty()
				if tc.iniValue != nil {
					section, err := iniFile.NewSection("annotations.app_platform")
					require.NoError(t, err)

					_, err = section.NewKey("retention_ttl", *tc.iniValue)
					require.NoError(t, err)
				}

				settings, err := loadAnnotationAppPlatformSettings(&Cfg{Raw: iniFile})
				if tc.expectErr {
					assert.Error(t, err)
					return
				}

				require.NoError(t, err)
				assert.Equal(t, tc.expectedTTL, settings.RetentionTTL)
			})
		}
	})

	t.Run("TLSClientConfig", func(t *testing.T) {
		t.Run("configured CA bundle sets CAFile", func(t *testing.T) {
			const caPath = "/etc/grafana/ca.crt"

			iniFile := ini.Empty()
			section, err := iniFile.NewSection("grafana-apiserver")
			require.NoError(t, err)
			_, err = section.NewKey("apiservice_ca_bundle_file", caPath)
			require.NoError(t, err)

			settings, err := loadAnnotationAppPlatformSettings(&Cfg{Raw: iniFile})
			require.NoError(t, err)
			assert.Equal(t, caPath, settings.TLSClientConfig.CAFile)
			assert.Nil(t, settings.TLSClientConfig.CAData)
			assert.False(t, settings.TLSClientConfig.Insecure)
		})
		t.Run("no CA bundle verifies against system trust", func(t *testing.T) {
			settings, err := loadAnnotationAppPlatformSettings(&Cfg{Raw: ini.Empty(), Env: Prod})
			require.NoError(t, err)
			assert.False(t, settings.TLSClientConfig.Insecure)
			assert.Empty(t, settings.TLSClientConfig.CAFile)
			assert.Nil(t, settings.TLSClientConfig.CAData)
		})

		t.Run("no CA bundle in development skips verification", func(t *testing.T) {
			settings, err := loadAnnotationAppPlatformSettings(&Cfg{Raw: ini.Empty(), Env: Dev})
			require.NoError(t, err)
			assert.True(t, settings.TLSClientConfig.Insecure)
			assert.Empty(t, settings.TLSClientConfig.CAFile)
			assert.Nil(t, settings.TLSClientConfig.CAData)
		})
	})
}
