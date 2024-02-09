package config

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ envvars.Provider = (*PluginEnvVarsProvider)(nil)

type PluginEnvVarsProvider struct {
	cfg             *setting.Cfg
	settingProvider setting.Provider
	tracingCfg      config.Tracing
	features        featuremgmt.FeatureToggles
	license         plugins.Licensing
	log             log.Logger
}

func NewPluginEnvVarsProvider(cfg *setting.Cfg, settingProvider setting.Provider, pCfg *config.Cfg, features featuremgmt.FeatureToggles,
	license plugins.Licensing) *PluginEnvVarsProvider {
	return &PluginEnvVarsProvider{
		cfg:             cfg,
		settingProvider: settingProvider,
		features:        features,
		license:         license,
		tracingCfg:      pCfg.Tracing,
		log:             log.New("plugin.envvars"),
	}
}

func (p *PluginEnvVarsProvider) PluginEnvVars(ctx context.Context, plugin *plugins.Plugin) []string {
	hostEnv := []string{
		envVar("GF_VERSION", p.cfg.BuildVersion),
	}

	if p.license != nil {
		hostEnv = append(
			hostEnv,
			envVar("GF_EDITION", p.license.Edition()),
			envVar("GF_ENTERPRISE_LICENSE_PATH", p.license.Path()),
			envVar("GF_ENTERPRISE_APP_URL", p.license.AppURL()),
		)
		hostEnv = append(hostEnv, p.license.Environment()...)
	}

	if plugin.ExternalService != nil {
		hostEnv = append(
			hostEnv,
			envVar("GF_APP_URL", p.cfg.AppURL),
			envVar("GF_PLUGIN_APP_CLIENT_ID", plugin.ExternalService.ClientID),
			envVar("GF_PLUGIN_APP_CLIENT_SECRET", plugin.ExternalService.ClientSecret),
		)
		if plugin.ExternalService.PrivateKey != "" {
			hostEnv = append(hostEnv, envVar("GF_PLUGIN_APP_PRIVATE_KEY", plugin.ExternalService.PrivateKey))
		}
	}

	hostEnv = append(hostEnv, p.featureToggleEnableVars(ctx)...)
	hostEnv = append(hostEnv, p.awsEnvVars(plugin.PluginID())...)
	hostEnv = append(hostEnv, p.secureSocksProxyEnvVars()...)
	hostEnv = append(hostEnv, azsettings.WriteToEnvStr(p.cfg.Azure)...)
	hostEnv = append(hostEnv, p.tracingEnvVars(plugin)...)
	hostEnv = append(hostEnv, p.pluginSettingsEnvVars(plugin.PluginID())...)

	// If SkipHostEnvVars is enabled, get some allowed variables from the current process and pass
	// them down to the plugin. If the flag is not set, do not add anything else because ALL env vars
	// from the current process (os.Environ()) will be forwarded to the plugin's process by go-plugin
	if plugin.SkipHostEnvVars {
		hostEnv = append(hostEnv, envvars.PermittedHostEnvVars()...)
	}

	return hostEnv
}

func (p *PluginEnvVarsProvider) featureToggleEnableVars(ctx context.Context) []string {
	var variables []string // an array is used for consistency and keep the logic simpler for no features case

	if p.features == nil {
		return variables
	}

	enabledFeatures := p.features.GetEnabled(ctx)
	if len(enabledFeatures) > 0 {
		features := make([]string, 0, len(enabledFeatures))
		for feat := range enabledFeatures {
			features = append(features, feat)
		}
		variables = append(variables, envVar("GF_INSTANCE_FEATURE_TOGGLES_ENABLE", strings.Join(features, ",")))
	}

	return variables
}

func (p *PluginEnvVarsProvider) awsEnvVars(pluginID string) []string {
	// Get aws settings from settingProvider instead of grafanaCfg
	aws := p.settingProvider.Section("aws")

	// TODO confirm if we want to change behaviour by gating with the below config
	awsForwardSettingsPlugins := p.cfg.AWSForwardSettingsPlugins
	if len(aws.KeyValue("forward_settings_to_plugins").Value()) > 0 {
		awsForwardSettingsPlugins = util.SplitString(aws.KeyValue("forward_settings_to_plugins").Value())
	}

	if !slices.Contains[[]string, string](awsForwardSettingsPlugins, pluginID) {
		return []string{}
	}

	var variables []string
	assumeRole := aws.KeyValue("assume_role_enabled").MustBool(p.cfg.AWSAssumeRoleEnabled)
	if !assumeRole {
		variables = append(variables, envVar(awsds.AssumeRoleEnabledEnvVarKeyName, "false"))
	}
	allowedAuth := aws.KeyValue("allowed_auth_providers").MustString(strings.Join(p.cfg.AWSAllowedAuthProviders, ","))
	if len(allowedAuth) > 0 {
		variables = append(variables, envVar(awsds.AllowedAuthProvidersEnvVarKeyName, allowedAuth))
	}
	externalID := aws.KeyValue("external_id").MustString(p.cfg.AWSExternalId)
	if externalID != "" {
		variables = append(variables, envVar(awsds.GrafanaAssumeRoleExternalIdKeyName, externalID))
	}
	sessionDuration := aws.KeyValue("session_duration").MustString(p.cfg.AWSSessionDuration)
	if sessionDuration != "" {
		variables = append(variables, envVar(awsds.SessionDurationEnvVarKeyName, sessionDuration))
	}
	listMetricsPageLimit := aws.KeyValue("list_metrics_page_limit").MustString(strconv.Itoa(p.cfg.AWSListMetricsPageLimit))
	if listMetricsPageLimit != "" {
		variables = append(variables, envVar(awsds.ListMetricsPageLimitKeyName, listMetricsPageLimit))
	}

	return variables
}

func (p *PluginEnvVarsProvider) secureSocksProxyEnvVars() []string {
	if p.cfg.SecureSocksDSProxy.Enabled {
		return []string{
			envVar(proxy.PluginSecureSocksProxyClientCert, p.cfg.SecureSocksDSProxy.ClientCert),
			envVar(proxy.PluginSecureSocksProxyClientKey, p.cfg.SecureSocksDSProxy.ClientKey),
			envVar(proxy.PluginSecureSocksProxyRootCACert, p.cfg.SecureSocksDSProxy.RootCA),
			envVar(proxy.PluginSecureSocksProxyProxyAddress, p.cfg.SecureSocksDSProxy.ProxyAddress),
			envVar(proxy.PluginSecureSocksProxyServerName, p.cfg.SecureSocksDSProxy.ServerName),
			envVar(proxy.PluginSecureSocksProxyEnabled, strconv.FormatBool(p.cfg.SecureSocksDSProxy.Enabled)),
			envVar(proxy.PluginSecureSocksProxyAllowInsecure, strconv.FormatBool(p.cfg.SecureSocksDSProxy.AllowInsecure)),
		}
	}
	return nil
}

func (p *PluginEnvVarsProvider) tracingEnvVars(plugin *plugins.Plugin) []string {
	pluginTracingEnabled := p.features.IsEnabledGlobally(featuremgmt.FlagEnablePluginsTracingByDefault)
	if v, exists := p.cfg.PluginSettings[plugin.ID]["tracing"]; exists && !pluginTracingEnabled {
		pluginTracingEnabled = v == "true"
	}

	if !p.tracingCfg.IsEnabled() || !pluginTracingEnabled {
		return nil
	}

	vars := []string{
		envVar("GF_INSTANCE_OTLP_ADDRESS", p.tracingCfg.OpenTelemetry.Address),
		envVar("GF_INSTANCE_OTLP_PROPAGATION", p.tracingCfg.OpenTelemetry.Propagation),
		envVar("GF_INSTANCE_OTLP_SAMPLER_TYPE", p.tracingCfg.OpenTelemetry.Sampler),
		fmt.Sprintf("GF_INSTANCE_OTLP_SAMPLER_PARAM=%.6f", p.tracingCfg.OpenTelemetry.SamplerParam),
		envVar("GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL", p.tracingCfg.OpenTelemetry.SamplerRemoteURL),
	}
	if plugin.Info.Version != "" {
		vars = append(vars, fmt.Sprintf("GF_PLUGIN_VERSION=%s", plugin.Info.Version))
	}
	return vars
}

func (p *PluginEnvVarsProvider) pluginSettingsEnvVars(pluginID string) []string {
	const customConfigPrefix = "GF_PLUGIN"
	var env []string
	for k, v := range p.cfg.PluginSettings[pluginID] {
		if k == "path" || strings.ToLower(k) == "id" {
			continue
		}
		key := fmt.Sprintf("%s_%s", customConfigPrefix, strings.ToUpper(k))
		if value := os.Getenv(key); value != "" {
			v = value
		}
		env = append(env, fmt.Sprintf("%s=%s", key, v))
	}
	return env
}

func envVar(key, value string) string {
	return fmt.Sprintf("%s=%s", key, value)
}
