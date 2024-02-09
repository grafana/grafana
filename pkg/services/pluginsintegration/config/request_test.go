package config

import (
	"context"
	"testing"

	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRequestConfigProvider_PluginRequestConfig(t *testing.T) {
	tcs := []struct {
		name     string
		cfg      *setting.Cfg
		features featuremgmt.FeatureToggles
		expected map[string]string
	}{
		{
			name:     "Both features and proxy settings enabled",
			features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
			cfg: &setting.Cfg{
				SecureSocksDSProxy: setting.SecureSocksDSProxySettings{
					Enabled:       true,
					ShowUI:        true,
					ClientCert:    "c3rt",
					ClientKey:     "k3y",
					RootCA:        "ca",
					ProxyAddress:  "https://proxy.grafana.com",
					ServerName:    "secureProxy",
					AllowInsecure: true,
				},
			},
			expected: map[string]string{
				"GF_INSTANCE_FEATURE_TOGGLES_ENABLE":              "feat-1,feat-2,feat-500",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED": "true",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT":    "c3rt",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY":     "k3y",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT":   "ca",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS":  "https://proxy.grafana.com",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME":    "secureProxy",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE": "true",
			},
		},
		{
			name:     "Features enabled but proxy settings disabled",
			features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
			cfg: &setting.Cfg{
				SecureSocksDSProxy: setting.SecureSocksDSProxySettings{
					Enabled:      false,
					ShowUI:       true,
					ClientCert:   "c3rt",
					ClientKey:    "k3y",
					RootCA:       "ca",
					ProxyAddress: "https://proxy.grafana.com",
					ServerName:   "secureProxy",
				},
			},
			expected: map[string]string{
				"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "feat-1,feat-2,feat-500",
			},
		},
		{
			name:     "Both features and proxy settings disabled",
			features: featuremgmt.WithFeatures("feat-2", false),
			cfg: &setting.Cfg{
				SecureSocksDSProxy: setting.SecureSocksDSProxySettings{
					Enabled:      false,
					ShowUI:       true,
					ClientCert:   "c3rt",
					ClientKey:    "k3y",
					RootCA:       "ca",
					ProxyAddress: "https://proxy.grafana.com",
					ServerName:   "secureProxy",
				},
			},
			expected: map[string]string{},
		},
		{
			name:     "Both features and proxy settings empty",
			features: featuremgmt.WithFeatures(),
			cfg: &setting.Cfg{
				SecureSocksDSProxy: setting.SecureSocksDSProxySettings{},
			},
			expected: map[string]string{},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			s := NewRequestConfigProvider(tc.cfg, setting.ProvideProvider(tc.cfg), tc.features)
			require.Equal(t, tc.expected, s.PluginRequestConfig(context.Background(), ""))
		})
	}
}

func TestRequestConfigProvider_PluginRequestConfig_featureToggles(t *testing.T) {
	t.Run("Feature toggles list is deterministic", func(t *testing.T) {
		tcs := []struct {
			features       featuremgmt.FeatureToggles
			expectedConfig map[string]string
		}{
			{
				features:       featuremgmt.WithFeatures(),
				expectedConfig: map[string]string{},
			},
			{
				features:       featuremgmt.WithFeatures("A", "B", "C"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "A,B,C"},
			},
			{
				features:       featuremgmt.WithFeatures("C", "B", "A"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "A,B,C"},
			},
			{
				features:       featuremgmt.WithFeatures("b", "a", "c", "d"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "a,b,c,d"},
			},
		}

		for _, tc := range tcs {
			cfg := setting.NewCfg()
			s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), tc.features)
			require.Equal(t, tc.expectedConfig, s.PluginRequestConfig(context.Background(), ""))
		}
	})
}

func TestRequestConfigProvider_PluginRequestConfig_appURL(t *testing.T) {
	t.Run("Uses the configured app URL", func(t *testing.T) {
		cfg := &setting.Cfg{
			AppURL: "https://myorg.com/",
		}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{"GF_APP_URL": "https://myorg.com/"}, s.PluginRequestConfig(context.Background(), ""))
	})
}

func TestRequestConfigProvider_PluginRequestConfig_concurrentQueryCount(t *testing.T) {
	t.Run("Uses the configured concurrent query count", func(t *testing.T) {
		cfg := &setting.Cfg{ConcurrentQueryCount: 42}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())

		require.Equal(t, map[string]string{"GF_CONCURRENT_QUERY_COUNT": "42"}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("Doesn't set the concurrent query count if it is not in the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("Doesn't set the concurrent query count if it is zero", func(t *testing.T) {
		cfg := &setting.Cfg{ConcurrentQueryCount: 0}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})
}

func TestRequestConfigProvider_PluginRequestConfig_azureAuthEnabled(t *testing.T) {
	t.Run("Uses the configured azureAuthEnabled", func(t *testing.T) {
		cfg := &setting.Cfg{AzureAuthEnabled: true}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{"GFAZPL_AZURE_AUTH_ENABLED": "true"}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("Doesn't set the azureAuthEnabled if it is not in the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("Doesn't set the azureAuthEnabled if it is false", func(t *testing.T) {
		cfg := &setting.Cfg{AzureAuthEnabled: false}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})
}

func TestRequestConfigProvider_PluginRequestConfig_azure(t *testing.T) {
	azSettings := &azsettings.AzureSettings{
		Cloud:                   azsettings.AzurePublic,
		ManagedIdentityEnabled:  true,
		ManagedIdentityClientId: "mock_managed_identity_client_id",
		WorkloadIdentityEnabled: true,
		WorkloadIdentitySettings: &azsettings.WorkloadIdentitySettings{
			TenantId:  "mock_workload_identity_tenant_id",
			ClientId:  "mock_workload_identity_client_id",
			TokenFile: "mock_workload_identity_token_file",
		},
		UserIdentityEnabled: true,
		UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
			TokenUrl:          "mock_user_identity_token_url",
			ClientId:          "mock_user_identity_client_id",
			ClientSecret:      "mock_user_identity_client_secret",
			UsernameAssertion: true,
		},
		ForwardSettingsPlugins: []string{"grafana-azure-monitor-datasource", "prometheus", "grafana-azure-data-explorer-datasource", "mssql"},
	}

	t.Run("uses the azure settings for an Azure plugin", func(t *testing.T) {
		cfg := &setting.Cfg{Azure: azSettings}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())

		require.Equal(t, map[string]string{
			"GFAZPL_AZURE_CLOUD": "AzureCloud", "GFAZPL_MANAGED_IDENTITY_ENABLED": "true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID":   "mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED":    "true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID":  "mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID":  "mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE": "mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED":        "true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL":      "mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID":      "mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET":  "mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION":      "username",
		}, s.PluginRequestConfig(context.Background(), "grafana-azure-monitor-datasource"))
	})

	t.Run("does not use the azure settings for a non-Azure plugin", func(t *testing.T) {
		cfg := &setting.Cfg{Azure: azSettings}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())

		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("uses the azure settings for a non-Azure user-specified plugin", func(t *testing.T) {
		azSettings.ForwardSettingsPlugins = append(azSettings.ForwardSettingsPlugins, "test-datasource")
		cfg := &setting.Cfg{Azure: azSettings}
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{
			"GFAZPL_AZURE_CLOUD": "AzureCloud", "GFAZPL_MANAGED_IDENTITY_ENABLED": "true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID":   "mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED":    "true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID":  "mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID":  "mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE": "mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED":        "true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL":      "mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID":      "mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET":  "mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION":      "username",
		}, s.PluginRequestConfig(context.Background(), "test-datasource"))
	})
}

func TestRequestConfigProvider_PluginRequestConfig_aws(t *testing.T) {
	cfg := &setting.Cfg{
		Raw:                       ini.Empty(),
		AWSAssumeRoleEnabled:      false,
		AWSAllowedAuthProviders:   []string{"grafana_assume_role", "keys"},
		AWSExternalId:             "mock_external_id",
		AWSSessionDuration:        "10m",
		AWSListMetricsPageLimit:   100,
		AWSForwardSettingsPlugins: []string{"cloudwatch", "prometheus", "elasticsearch"},
	}

	t.Run("uses the aws settings for an AWS plugin", func(t *testing.T) {
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		}, s.PluginRequestConfig(context.Background(), "cloudwatch"))
	})

	t.Run("does not use the aws settings for a non-aws plugin", func(t *testing.T) {
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{}, s.PluginRequestConfig(context.Background(), ""))
	})

	t.Run("uses the aws settings for a non-aws user-specified plugin", func(t *testing.T) {
		cfg.AWSForwardSettingsPlugins = append(cfg.AWSForwardSettingsPlugins, "test-datasource")
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Equal(t, map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		}, s.PluginRequestConfig(context.Background(), "test-datasource"))
	})
}
