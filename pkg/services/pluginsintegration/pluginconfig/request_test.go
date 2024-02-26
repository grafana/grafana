package pluginconfig

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRequestConfigProvider_PluginRequestConfig_Defaults(t *testing.T) {
	cfg := setting.NewCfg()
	s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())

	require.Equal(t, map[string]string{
		"GF_SQL_MAX_OPEN_CONNS_DEFAULT":            "0",
		"GF_SQL_MAX_IDLE_CONNS_DEFAULT":            "0",
		"GF_SQL_MAX_CONN_LIFETIME_SECONDS_DEFAULT": "0",
	}, s.PluginRequestConfig(context.Background(), ""))
}

func TestRequestConfigProvider_PluginRequestConfig(t *testing.T) {
	tcs := []struct {
		name     string
		cfg      *setting.Cfg
		features featuremgmt.FeatureToggles
		expected map[string]string
	}{
		{
			name: "Both features and proxy settings enabled",
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
			features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
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
			name: "Features enabled but proxy settings disabled",
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
			features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
			expected: map[string]string{
				"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "feat-1,feat-2,feat-500",
			},
		},
		{
			name: "Both features and proxy settings disabled",
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
			features: featuremgmt.WithFeatures("feat-2", false),
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
			s := NewRequestConfigProvider(
				tc.cfg, setting.ProvideProvider(tc.cfg), tc.features,
			)
			require.Subset(t, s.PluginRequestConfig(context.Background(), ""), tc.expected)
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
			s := NewRequestConfigProvider(
				cfg, setting.ProvideProvider(cfg), tc.features,
			)
			require.Subset(t, s.PluginRequestConfig(context.Background(), ""), tc.expectedConfig)
		}
	})
}

func TestRequestConfigProvider_PluginRequestConfig_appURL(t *testing.T) {
	t.Run("Uses the configured app URL", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AppURL = "https://myorg.com/"

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)
		require.Subset(t, s.PluginRequestConfig(context.Background(), ""), map[string]string{"GF_APP_URL": "https://myorg.com/"})
	})
}

func TestRequestConfigProvider_PluginRequestConfig_SQL(t *testing.T) {
	t.Run("Uses the configured values", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.DataProxyRowLimit = 23
		cfg.SqlDatasourceMaxOpenConnsDefault = 24
		cfg.SqlDatasourceMaxIdleConnsDefault = 25
		cfg.SqlDatasourceMaxConnLifetimeDefault = 26

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)

		require.Subset(t, s.PluginRequestConfig(context.Background(), ""), map[string]string{
			"GF_SQL_ROW_LIMIT":                         "23",
			"GF_SQL_MAX_OPEN_CONNS_DEFAULT":            "24",
			"GF_SQL_MAX_IDLE_CONNS_DEFAULT":            "25",
			"GF_SQL_MAX_CONN_LIFETIME_SECONDS_DEFAULT": "26",
		})
	})

	t.Run("Uses the configured max-default-values, even when they are zero", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.SqlDatasourceMaxOpenConnsDefault = 0
		cfg.SqlDatasourceMaxIdleConnsDefault = 0
		cfg.SqlDatasourceMaxConnLifetimeDefault = 0

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)

		require.Equal(t, map[string]string{
			"GF_SQL_MAX_OPEN_CONNS_DEFAULT":            "0",
			"GF_SQL_MAX_IDLE_CONNS_DEFAULT":            "0",
			"GF_SQL_MAX_CONN_LIFETIME_SECONDS_DEFAULT": "0",
		}, s.PluginRequestConfig(context.Background(), ""))
	})
}

func TestRequestConfigProvider_PluginRequestConfig_concurrentQueryCount(t *testing.T) {
	t.Run("Uses the configured concurrent query count", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ConcurrentQueryCount = 42

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)
		require.Subset(t, s.PluginRequestConfig(context.Background(), ""), map[string]string{"GF_CONCURRENT_QUERY_COUNT": "42"})
	})

	t.Run("Doesn't set the concurrent query count if it is not in the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)
		require.NotContains(t, s.PluginRequestConfig(context.Background(), ""), "GF_CONCURRENT_QUERY_COUNT")
	})

	t.Run("Doesn't set the concurrent query count if it is zero", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ConcurrentQueryCount = 0

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)
		require.NotContains(t, s.PluginRequestConfig(context.Background(), ""), "GF_CONCURRENT_QUERY_COUNT")
	})
}

func TestRequestConfigProvider_PluginRequestConfig_azureAuthEnabled(t *testing.T) {
	t.Run("Uses the configured azureAuthEnabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AzureAuthEnabled = true

		s := NewRequestConfigProvider(
			cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		)
		require.Subset(t, s.PluginRequestConfig(context.Background(), ""), map[string]string{"GFAZPL_AZURE_AUTH_ENABLED": "true"})
	})

	t.Run("Doesn't set the azureAuthEnabled if it is not in the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NotContains(t, s.PluginRequestConfig(context.Background(), ""), "GFAZPL_AZURE_AUTH_ENABLED")
	})

	t.Run("Doesn't set the azureAuthEnabled if it is false", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AzureAuthEnabled = false

		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NotContains(t, s.PluginRequestConfig(context.Background(), ""), "GFAZPL_AZURE_AUTH_ENABLED")
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
		cfg := setting.NewCfg()
		cfg.Azure = azSettings

		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Subset(t, s.PluginRequestConfig(context.Background(), "grafana-azure-monitor-datasource"), map[string]string{
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
		})
	})

	t.Run("does not use the azure settings for a non-Azure plugin", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Azure = azSettings

		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		m := s.PluginRequestConfig(context.Background(), "")
		require.NotContains(t, m, "GFAZPL_AZURE_CLOUD")
		require.NotContains(t, m, "GFAZPL_MANAGED_IDENTITY_ENABLED")
		require.NotContains(t, m, "GFAZPL_MANAGED_IDENTITY_CLIENT_ID")
		require.NotContains(t, m, "GFAZPL_WORKLOAD_IDENTITY_ENABLED")
		require.NotContains(t, m, "GFAZPL_WORKLOAD_IDENTITY_TENANT_ID")
		require.NotContains(t, m, "GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID")
		require.NotContains(t, m, "GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE")
		require.NotContains(t, m, "GFAZPL_USER_IDENTITY_ENABLED")
		require.NotContains(t, m, "GFAZPL_USER_IDENTITY_TOKEN_URL")
		require.NotContains(t, m, "GFAZPL_USER_IDENTITY_CLIENT_ID")
		require.NotContains(t, m, "GFAZPL_USER_IDENTITY_CLIENT_SECRET")
		require.NotContains(t, m, "GFAZPL_USER_IDENTITY_ASSERTION")
	})

	t.Run("uses the azure settings for a non-Azure user-specified plugin", func(t *testing.T) {
		azSettings.ForwardSettingsPlugins = append(azSettings.ForwardSettingsPlugins, "test-datasource")
		cfg := setting.NewCfg()
		cfg.Azure = azSettings

		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Subset(t, s.PluginRequestConfig(context.Background(), "test-datasource"), map[string]string{
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
		})
	})
}

func TestRequestConfigProvider_PluginRequestConfig_aws(t *testing.T) {
	cfg := setting.NewCfg()

	cfg.AWSAssumeRoleEnabled = false
	cfg.AWSAllowedAuthProviders = []string{"grafana_assume_role", "keys"}
	cfg.AWSExternalId = "mock_external_id"
	cfg.AWSSessionDuration = "10m"
	cfg.AWSListMetricsPageLimit = 100
	cfg.AWSForwardSettingsPlugins = []string{"cloudwatch", "prometheus", "elasticsearch"}

	t.Run("uses the aws settings for an AWS plugin", func(t *testing.T) {
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())

		require.Subset(t, s.PluginRequestConfig(context.Background(), "cloudwatch"), map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		})
	})

	t.Run("does not use the aws settings for a non-aws plugin", func(t *testing.T) {
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		m := s.PluginRequestConfig(context.Background(), "")
		require.NotContains(t, m, "AWS_AUTH_AssumeRoleEnabled")
		require.NotContains(t, m, "AWS_AUTH_AllowedAuthProviders")
		require.NotContains(t, m, "AWS_AUTH_EXTERNAL_ID")
		require.NotContains(t, m, "AWS_AUTH_SESSION_DURATION")
		require.NotContains(t, m, "AWS_CW_LIST_METRICS_PAGE_LIMIT")
	})

	t.Run("uses the aws settings for a non-aws user-specified plugin", func(t *testing.T) {
		cfg.AWSForwardSettingsPlugins = append(cfg.AWSForwardSettingsPlugins, "test-datasource")
		s := NewRequestConfigProvider(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.Subset(t, s.PluginRequestConfig(context.Background(), "test-datasource"), map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		})
	})
}
