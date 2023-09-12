package envvars

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/oauthtokenretriever"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/oauth"
)

const (
	customConfigPrefix = "GF_PLUGIN"
)

type Provider interface {
	Get(ctx context.Context, p *plugins.Plugin) []string
}

type Service struct {
	cfg     *config.Cfg
	license plugins.Licensing
}

func NewProvider(cfg *config.Cfg, license plugins.Licensing) *Service {
	return &Service{
		cfg:     cfg,
		license: license,
	}
}

func (s *Service) Get(ctx context.Context, p *plugins.Plugin) []string {
	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", s.cfg.BuildVersion),
	}

	if s.license != nil {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_EDITION=%s", s.license.Edition()),
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", s.license.Path()),
			fmt.Sprintf("GF_ENTERPRISE_APP_URL=%s", s.license.AppURL()),
		)
		hostEnv = append(hostEnv, s.license.Environment()...)
	}

	if p.ExternalService != nil {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_APP_URL=%s", s.cfg.GrafanaAppURL),
			fmt.Sprintf("GF_PLUGIN_APP_CLIENT_ID=%s", p.ExternalService.ClientID),
			fmt.Sprintf("GF_PLUGIN_APP_CLIENT_SECRET=%s", p.ExternalService.ClientSecret),
			fmt.Sprintf("GF_PLUGIN_APP_PRIVATE_KEY=%s", p.ExternalService.PrivateKey),
		)
	}

	hostEnv = append(hostEnv, s.featureToggleEnableVar(ctx)...)
	hostEnv = append(hostEnv, s.awsEnvVars()...)
	hostEnv = append(hostEnv, s.secureSocksProxyEnvVars()...)
	hostEnv = append(hostEnv, azsettings.WriteToEnvStr(s.cfg.Azure)...)
	hostEnv = append(hostEnv, s.tracingEnvVars(p)...)

	ev := getPluginSettings(p.ID, s.cfg).asEnvVar(customConfigPrefix, hostEnv...)
	return ev
}

// GetConfigMap returns a map of configuration that should be passed in a plugin request.
// Note: Licensing is not included as part of this resulting config map.
func (s *Service) GetConfigMap(ctx context.Context, pluginID string, externalService *oauth.ExternalService) map[string]string {
	m := map[string]string{
		//backend.GrafanaVersion: s.cfg.BuildVersion,
	}

	if externalService != nil {
		m[oauthtokenretriever.AppURL] = s.cfg.GrafanaAppURL
		m[oauthtokenretriever.AppClientID] = externalService.ClientID
		m[oauthtokenretriever.AppClientSecret] = externalService.ClientSecret
		m[oauthtokenretriever.AppPrivateKey] = externalService.PrivateKey
	}

	if s.cfg.Features != nil {
		enabledFeatures := s.cfg.Features.GetEnabled(ctx)
		enabledFeatures["FOO"] = true
		if len(enabledFeatures) > 0 {
			features := make([]string, 0, len(enabledFeatures))
			for feat := range enabledFeatures {
				features = append(features, feat)
			}
			m[featuretoggles.EnabledFeatures] = strings.Join(features, ",")
		}
	}

	if s.cfg.AWSAssumeRoleEnabled {
		m[awsds.AssumeRoleEnabledEnvVarKeyName] = "true"
	}
	if len(s.cfg.AWSAllowedAuthProviders) > 0 {
		m[awsds.AllowedAuthProvidersEnvVarKeyName] = strings.Join(s.cfg.AWSAllowedAuthProviders, ",")
	}
	if s.cfg.AWSExternalId != "" {
		m[awsds.GrafanaAssumeRoleExternalIdKeyName] = s.cfg.AWSExternalId
	}

	if s.cfg.ProxySettings.Enabled {
		m[proxy.PluginSecureSocksProxyEnabled] = "true"
		m[proxy.PluginSecureSocksProxyClientCert] = s.cfg.ProxySettings.ClientCert
		m[proxy.PluginSecureSocksProxyClientKey] = s.cfg.ProxySettings.ClientKey
		m[proxy.PluginSecureSocksProxyRootCACert] = s.cfg.ProxySettings.RootCA
		m[proxy.PluginSecureSocksProxyProxyAddress] = s.cfg.ProxySettings.ProxyAddress
		m[proxy.PluginSecureSocksProxyServerName] = s.cfg.ProxySettings.ServerName
	}

	azureSettings := s.cfg.Azure
	if azureSettings != nil {
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
	}

	ps := getPluginSettings(pluginID, s.cfg)
	for k, v := range ps {
		m[fmt.Sprintf("%s_%s", customConfigPrefix, strings.ToUpper(k))] = v
	}

	return m
}

func (s *Service) tracingEnvVars(plugin *plugins.Plugin) []string {
	var pluginTracingEnabled bool
	if v, exists := s.cfg.PluginSettings[plugin.ID]["tracing"]; exists {
		pluginTracingEnabled = v == "true"
	}
	if !s.cfg.Tracing.IsEnabled() || !pluginTracingEnabled {
		return nil
	}

	vars := []string{
		fmt.Sprintf("GF_INSTANCE_OTLP_ADDRESS=%s", s.cfg.Tracing.OpenTelemetry.Address),
		fmt.Sprintf("GF_INSTANCE_OTLP_PROPAGATION=%s", s.cfg.Tracing.OpenTelemetry.Propagation),
	}
	if plugin.Info.Version != "" {
		vars = append(vars, fmt.Sprintf("GF_PLUGIN_VERSION=%s", plugin.Info.Version))
	}
	return vars
}

func (s *Service) featureToggleEnableVar(ctx context.Context) []string {
	var variables []string // an array is used for consistency and keep the logic simpler for no features case

	if s.cfg.Features != nil {
		enabledFeatures := s.cfg.Features.GetEnabled(ctx)

		if len(enabledFeatures) > 0 {
			features := make([]string, 0, len(enabledFeatures))
			for feat := range enabledFeatures {
				features = append(features, feat)
			}
			variables = append(variables, fmt.Sprintf("GF_INSTANCE_FEATURE_TOGGLES_ENABLE=%s", strings.Join(features, ",")))
		}
	}

	return variables
}

func (s *Service) awsEnvVars() []string {
	var variables []string
	if s.cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(s.cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(s.cfg.AWSAllowedAuthProviders, ","))
	}
	if s.cfg.AWSExternalId != "" {
		variables = append(variables, awsds.GrafanaAssumeRoleExternalIdKeyName+"="+s.cfg.AWSExternalId)
	}

	return variables
}

func (s *Service) secureSocksProxyEnvVars() []string {
	if s.cfg.ProxySettings.Enabled {
		return []string{
			proxy.PluginSecureSocksProxyClientCert + "=" + s.cfg.ProxySettings.ClientCert,
			proxy.PluginSecureSocksProxyClientKey + "=" + s.cfg.ProxySettings.ClientKey,
			proxy.PluginSecureSocksProxyRootCACert + "=" + s.cfg.ProxySettings.RootCA,
			proxy.PluginSecureSocksProxyProxyAddress + "=" + s.cfg.ProxySettings.ProxyAddress,
			proxy.PluginSecureSocksProxyServerName + "=" + s.cfg.ProxySettings.ServerName,
			proxy.PluginSecureSocksProxyEnabled + "=" + strconv.FormatBool(s.cfg.ProxySettings.Enabled),
		}
	}
	return nil
}

type pluginSettings map[string]string

func getPluginSettings(pluginID string, cfg *config.Cfg) pluginSettings {
	ps := pluginSettings{}
	for k, v := range cfg.PluginSettings[pluginID] {
		if k == "path" || strings.ToLower(k) == "id" {
			continue
		}
		ps[k] = v
	}

	return ps
}

func (ps pluginSettings) asEnvVar(prefix string, hostEnv ...string) []string {
	env := make([]string, 0, len(ps))
	for k, v := range ps {
		key := fmt.Sprintf("%s_%s", prefix, strings.ToUpper(k))
		if value := os.Getenv(key); value != "" {
			v = value
		}

		env = append(env, fmt.Sprintf("%s=%s", key, v))
	}

	env = append(env, hostEnv...)

	return env
}
