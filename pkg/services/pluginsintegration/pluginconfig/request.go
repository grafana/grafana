package pluginconfig

import (
	"context"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana/pkg/plugins/auth"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
)

var _ PluginRequestConfigProvider = (*RequestConfigProvider)(nil)

type PluginRequestConfigProvider interface {
	PluginRequestConfig(ctx context.Context, pluginID string, externalService *auth.ExternalService) map[string]string
}

type RequestConfigProvider struct {
	cfg *PluginInstanceCfg
}

func NewRequestConfigProvider(cfg *PluginInstanceCfg) *RequestConfigProvider {
	return &RequestConfigProvider{
		cfg: cfg,
	}
}

// PluginRequestConfig returns a map of configuration that should be passed in a plugin request.
// nolint:gocyclo
func (s *RequestConfigProvider) PluginRequestConfig(ctx context.Context, pluginID string, externalService *auth.ExternalService) map[string]string {
	m := make(map[string]string)

	if s.cfg.GrafanaAppURL != "" {
		m[backend.AppURL] = s.cfg.GrafanaAppURL
	}
	if s.cfg.ConcurrentQueryCount != 0 {
		m[backend.ConcurrentQueryCount] = strconv.Itoa(s.cfg.ConcurrentQueryCount)
	}

	enabledFeatures := s.cfg.Features.GetEnabled(ctx)
	if len(enabledFeatures) > 0 {
		features := make([]string, 0, len(enabledFeatures))
		for feat := range enabledFeatures {
			features = append(features, feat)
		}
		sort.Strings(features)
		m[featuretoggles.EnabledFeatures] = strings.Join(features, ",")
	}

	if slices.Contains[[]string, string](s.cfg.AWSForwardSettingsPlugins, pluginID) {
		if !s.cfg.AWSAssumeRoleEnabled {
			m[awsds.AssumeRoleEnabledEnvVarKeyName] = "false"
		}
		if len(s.cfg.AWSAllowedAuthProviders) > 0 {
			m[awsds.AllowedAuthProvidersEnvVarKeyName] = strings.Join(s.cfg.AWSAllowedAuthProviders, ",")
		}
		if s.cfg.AWSExternalId != "" {
			m[awsds.GrafanaAssumeRoleExternalIdKeyName] = s.cfg.AWSExternalId
		}
		if s.cfg.AWSSessionDuration != "" {
			m[awsds.SessionDurationEnvVarKeyName] = s.cfg.AWSSessionDuration
		}
		if s.cfg.AWSListMetricsPageLimit != "" {
			m[awsds.ListMetricsPageLimitKeyName] = s.cfg.AWSListMetricsPageLimit
		}
	}

	if s.cfg.ProxySettings.Enabled {
		m[proxy.PluginSecureSocksProxyEnabled] = "true"
		m[proxy.PluginSecureSocksProxyClientCert] = s.cfg.ProxySettings.ClientCertFilePath
		m[proxy.PluginSecureSocksProxyClientCertContents] = s.cfg.ProxySettings.ClientCert
		m[proxy.PluginSecureSocksProxyClientKey] = s.cfg.ProxySettings.ClientKeyFilePath
		m[proxy.PluginSecureSocksProxyClientKeyContents] = s.cfg.ProxySettings.ClientKey
		m[proxy.PluginSecureSocksProxyRootCAs] = strings.Join(s.cfg.ProxySettings.RootCAFilePaths, " ")
		m[proxy.PluginSecureSocksProxyRootCAsContents] = strings.Join(s.cfg.ProxySettings.RootCAs, ",")
		m[proxy.PluginSecureSocksProxyProxyAddress] = s.cfg.ProxySettings.ProxyAddress
		m[proxy.PluginSecureSocksProxyServerName] = s.cfg.ProxySettings.ServerName
		m[proxy.PluginSecureSocksProxyAllowInsecure] = strconv.FormatBool(s.cfg.ProxySettings.AllowInsecure)
	}

	// Settings here will be extracted by grafana-azure-sdk-go from the plugin context
	if s.cfg.AzureAuthEnabled {
		m[azsettings.AzureAuthEnabled] = strconv.FormatBool(s.cfg.AzureAuthEnabled)
	}
	azureSettings := s.cfg.Azure
	if azureSettings != nil && slices.Contains[[]string, string](azureSettings.ForwardSettingsPlugins, pluginID) {
		if azureSettings.Cloud != "" {
			m[azsettings.AzureCloud] = azureSettings.Cloud
		}

		if len(azureSettings.CustomCloudListJSON) > 0 {
			m[azsettings.AzureCustomCloudsConfig] = azureSettings.CustomCloudListJSON
		}

		if azureSettings.ManagedIdentityEnabled {
			m[azsettings.ManagedIdentityEnabled] = "true"

			if azureSettings.ManagedIdentityClientId != "" {
				m[azsettings.ManagedIdentityClientID] = azureSettings.ManagedIdentityClientId
			}
		}

		if azureSettings.UserIdentityEnabled {
			m[azsettings.UserIdentityEnabled] = "true"
			m[azsettings.UserIdentityFallbackCredentialsEnabled] = strconv.FormatBool(azureSettings.UserIdentityFallbackCredentialsEnabled)

			if azureSettings.UserIdentityTokenEndpoint != nil {
				if azureSettings.UserIdentityTokenEndpoint.TokenUrl != "" {
					m[azsettings.UserIdentityTokenURL] = azureSettings.UserIdentityTokenEndpoint.TokenUrl
				}
				if azureSettings.UserIdentityTokenEndpoint.ClientAuthentication != "" {
					m[azsettings.UserIdentityClientAuthentication] = azureSettings.UserIdentityTokenEndpoint.ClientAuthentication
				}
				if azureSettings.UserIdentityTokenEndpoint.ClientId != "" {
					m[azsettings.UserIdentityClientID] = azureSettings.UserIdentityTokenEndpoint.ClientId
				}
				if azureSettings.UserIdentityTokenEndpoint.ClientSecret != "" {
					m[azsettings.UserIdentityClientSecret] = azureSettings.UserIdentityTokenEndpoint.ClientSecret
				}
				if azureSettings.UserIdentityTokenEndpoint.ManagedIdentityClientId != "" {
					m[azsettings.UserIdentityManagedIdentityClientID] = azureSettings.UserIdentityTokenEndpoint.ManagedIdentityClientId
				}
				if azureSettings.UserIdentityTokenEndpoint.FederatedCredentialAudience != "" {
					m[azsettings.UserIdentityFederatedCredentialAudience] = azureSettings.UserIdentityTokenEndpoint.FederatedCredentialAudience
				}
				if azureSettings.UserIdentityTokenEndpoint.UsernameAssertion {
					m[azsettings.UserIdentityAssertion] = "username"
				}
			}
		}

		if azureSettings.WorkloadIdentityEnabled {
			m[azsettings.WorkloadIdentityEnabled] = "true"

			if azureSettings.WorkloadIdentitySettings != nil {
				if azureSettings.WorkloadIdentitySettings.ClientId != "" {
					m[azsettings.WorkloadIdentityClientID] = azureSettings.WorkloadIdentitySettings.ClientId
				}
				if azureSettings.WorkloadIdentitySettings.TenantId != "" {
					m[azsettings.WorkloadIdentityTenantID] = azureSettings.WorkloadIdentitySettings.TenantId
				}
				if azureSettings.WorkloadIdentitySettings.TokenFile != "" {
					m[azsettings.WorkloadIdentityTokenFile] = azureSettings.WorkloadIdentitySettings.TokenFile
				}
			}
		}

		m[azsettings.AzureEntraPasswordCredentialsEnabled] = strconv.FormatBool(azureSettings.AzureEntraPasswordCredentialsEnabled)
	}

	if s.cfg.UserFacingDefaultError != "" {
		m[backend.UserFacingDefaultError] = s.cfg.UserFacingDefaultError
	}

	if s.cfg.DataProxyRowLimit != 0 {
		m[backend.SQLRowLimit] = strconv.FormatInt(s.cfg.DataProxyRowLimit, 10)
	}

	m[backend.SQLMaxOpenConnsDefault] = strconv.Itoa(s.cfg.SQLDatasourceMaxOpenConnsDefault)
	m[backend.SQLMaxIdleConnsDefault] = strconv.Itoa(s.cfg.SQLDatasourceMaxIdleConnsDefault)
	m[backend.SQLMaxConnLifetimeSecondsDefault] = strconv.Itoa(s.cfg.SQLDatasourceMaxConnLifetimeDefault)

	if s.cfg.ResponseLimit > 0 {
		m[backend.ResponseLimit] = strconv.FormatInt(s.cfg.ResponseLimit, 10)
	}

	if s.cfg.SigV4AuthEnabled {
		m[awsds.SigV4AuthEnabledEnvVarKeyName] = "true"
		m[awsds.SigV4VerboseLoggingEnvVarKeyName] = strconv.FormatBool(s.cfg.SigV4VerboseLogging)
	}

	if externalService != nil {
		m[backend.AppClientSecret] = externalService.ClientSecret
	}

	return m
}
