package config

import (
	"context"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ PluginRequestConfigProvider = (*RequestConfigProvider)(nil)

type PluginRequestConfigProvider interface {
	PluginRequestConfig(ctx context.Context, pluginID string) map[string]string
}

type RequestConfigProvider struct {
	cfg             *setting.Cfg
	settingProvider setting.Provider
	features        featuremgmt.FeatureToggles
}

func NewRequestConfigProvider(cfg *setting.Cfg, settingProvider setting.Provider,
	features featuremgmt.FeatureToggles) *RequestConfigProvider {
	return &RequestConfigProvider{
		cfg:             cfg,
		settingProvider: settingProvider,
		features:        features,
	}
}

// PluginRequestConfig returns a map of configuration that should be passed in a plugin request.
func (s *RequestConfigProvider) PluginRequestConfig(ctx context.Context, pluginID string) map[string]string {
	m := make(map[string]string)

	if s.cfg.AppURL != "" {
		m[backend.AppURL] = s.cfg.AppURL
	}
	if s.cfg.ConcurrentQueryCount != 0 {
		m[backend.ConcurrentQueryCount] = strconv.Itoa(s.cfg.ConcurrentQueryCount)
	}

	enabledFeatures := s.features.GetEnabled(ctx)
	if len(enabledFeatures) > 0 {
		features := make([]string, 0, len(enabledFeatures))
		for feat := range enabledFeatures {
			features = append(features, feat)
		}
		sort.Strings(features)
		m[featuretoggles.EnabledFeatures] = strings.Join(features, ",")
	}

	if slices.Contains[[]string, string](s.cfg.AWSForwardSettingsPlugins, pluginID) {
		aws := s.settingProvider.Section("aws")

		assumeRole := aws.KeyValue("assume_role_enabled").MustBool(s.cfg.AWSAssumeRoleEnabled)
		if !assumeRole {
			m[awsds.AssumeRoleEnabledEnvVarKeyName] = strconv.FormatBool(assumeRole)
		}
		allowedAuth := aws.KeyValue("allowed_auth_providers").MustString(strings.Join(s.cfg.AWSAllowedAuthProviders, ","))
		if len(allowedAuth) > 0 {
			m[awsds.AllowedAuthProvidersEnvVarKeyName] = allowedAuth
		}
		externalID := aws.KeyValue("external_id").MustString(s.cfg.AWSExternalId)
		if externalID != "" {
			m[awsds.GrafanaAssumeRoleExternalIdKeyName] = externalID
		}
		sessionDuration := aws.KeyValue("session_duration").MustString(s.cfg.AWSSessionDuration)
		if sessionDuration != "" {
			m[awsds.SessionDurationEnvVarKeyName] = sessionDuration
		}
		listMetricsPageLimit := aws.KeyValue("list_metrics_page_limit").MustString(strconv.Itoa(s.cfg.AWSListMetricsPageLimit))
		if listMetricsPageLimit != "" {
			m[awsds.ListMetricsPageLimitKeyName] = listMetricsPageLimit
		}
	}

	if s.cfg.SecureSocksDSProxy.Enabled {
		m[proxy.PluginSecureSocksProxyEnabled] = "true"
		m[proxy.PluginSecureSocksProxyClientCert] = s.cfg.SecureSocksDSProxy.ClientCert
		m[proxy.PluginSecureSocksProxyClientKey] = s.cfg.SecureSocksDSProxy.ClientKey
		m[proxy.PluginSecureSocksProxyRootCACert] = s.cfg.SecureSocksDSProxy.RootCA
		m[proxy.PluginSecureSocksProxyProxyAddress] = s.cfg.SecureSocksDSProxy.ProxyAddress
		m[proxy.PluginSecureSocksProxyServerName] = s.cfg.SecureSocksDSProxy.ServerName
		m[proxy.PluginSecureSocksProxyAllowInsecure] = strconv.FormatBool(s.cfg.SecureSocksDSProxy.AllowInsecure)
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

		if azureSettings.ManagedIdentityEnabled {
			m[azsettings.ManagedIdentityEnabled] = "true"

			if azureSettings.ManagedIdentityClientId != "" {
				m[azsettings.ManagedIdentityClientID] = azureSettings.ManagedIdentityClientId
			}
		}

		if azureSettings.UserIdentityEnabled {
			m[azsettings.UserIdentityEnabled] = "true"

			if azureSettings.UserIdentityTokenEndpoint != nil {
				if azureSettings.UserIdentityTokenEndpoint.TokenUrl != "" {
					m[azsettings.UserIdentityTokenURL] = azureSettings.UserIdentityTokenEndpoint.TokenUrl
				}
				if azureSettings.UserIdentityTokenEndpoint.ClientId != "" {
					m[azsettings.UserIdentityClientID] = azureSettings.UserIdentityTokenEndpoint.ClientId
				}
				if azureSettings.UserIdentityTokenEndpoint.ClientSecret != "" {
					m[azsettings.UserIdentityClientSecret] = azureSettings.UserIdentityTokenEndpoint.ClientSecret
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
	}

	return m
}
