package pluginconfig

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/envvars"
)

var _ envvars.Provider = (*EnvVarsProvider)(nil)

type EnvVarsProvider struct {
	cfg     *PluginInstanceCfg
	license plugins.Licensing
	logger  log.Logger
}

func NewEnvVarsProvider(cfg *PluginInstanceCfg, license plugins.Licensing) *EnvVarsProvider {
	return &EnvVarsProvider{
		cfg:     cfg,
		license: license,
		logger:  log.New("plugins.envvars"),
	}
}

func (p *EnvVarsProvider) PluginEnvVars(ctx context.Context, plugin *plugins.Plugin) []string {
	hostEnv := []string{
		p.envVar("GF_VERSION", p.cfg.GrafanaVersion),
	}

	if p.license != nil {
		hostEnv = append(
			hostEnv,
			p.envVar("GF_EDITION", p.license.Edition()),
			p.envVar("GF_ENTERPRISE_LICENSE_PATH", p.license.Path()),
			p.envVar("GF_ENTERPRISE_APP_URL", p.license.AppURL()),
		)
		hostEnv = append(hostEnv, p.license.Environment()...)
	}

	if plugin.ExternalService != nil {
		hostEnv = append(
			hostEnv,
			p.envVar("GF_APP_URL", p.cfg.GrafanaAppURL),
			p.envVar("GF_PLUGIN_APP_CLIENT_ID", plugin.ExternalService.ClientID),
			p.envVar("GF_PLUGIN_APP_CLIENT_SECRET", plugin.ExternalService.ClientSecret),
		)
		if plugin.ExternalService.PrivateKey != "" {
			hostEnv = append(hostEnv, p.envVar("GF_PLUGIN_APP_PRIVATE_KEY", plugin.ExternalService.PrivateKey))
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

func (p *EnvVarsProvider) featureToggleEnableVars(ctx context.Context) []string {
	var variables []string // an array is used for consistency and keep the logic simpler for no features case

	if p.cfg.Features == nil {
		return variables
	}

	enabledFeatures := p.cfg.Features.GetEnabled(ctx)
	if len(enabledFeatures) > 0 {
		features := make([]string, 0, len(enabledFeatures))
		for feat := range enabledFeatures {
			features = append(features, feat)
		}
		variables = append(variables, p.envVar("GF_INSTANCE_FEATURE_TOGGLES_ENABLE", strings.Join(features, ",")))
	}

	return variables
}

func (p *EnvVarsProvider) awsEnvVars(pluginID string) []string {
	if !slices.Contains[[]string, string](p.cfg.AWSForwardSettingsPlugins, pluginID) {
		return []string{}
	}

	var variables []string
	if !p.cfg.AWSAssumeRoleEnabled {
		variables = append(variables, p.envVar(awsds.AssumeRoleEnabledEnvVarKeyName, "false"))
	}
	if len(p.cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, p.envVar(awsds.AllowedAuthProvidersEnvVarKeyName, strings.Join(p.cfg.AWSAllowedAuthProviders, ",")))
	}
	if p.cfg.AWSExternalId != "" {
		variables = append(variables, p.envVar(awsds.GrafanaAssumeRoleExternalIdKeyName, p.cfg.AWSExternalId))
	}
	if p.cfg.AWSSessionDuration != "" {
		variables = append(variables, p.envVar(awsds.SessionDurationEnvVarKeyName, p.cfg.AWSSessionDuration))
	}
	if p.cfg.AWSListMetricsPageLimit != "" {
		variables = append(variables, p.envVar(awsds.ListMetricsPageLimitKeyName, p.cfg.AWSListMetricsPageLimit))
	}

	return variables
}

func (p *EnvVarsProvider) secureSocksProxyEnvVars() []string {
	if p.cfg.ProxySettings.Enabled {
		return []string{
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyClientCertFilePathEnvVarName, p.cfg.ProxySettings.ClientCertFilePath),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyClientKeyFilePathEnvVarName, p.cfg.ProxySettings.ClientKeyFilePath),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyRootCACertFilePathsEnvVarName, strings.Join(p.cfg.ProxySettings.RootCAFilePaths, " ")),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyAddressEnvVarName, p.cfg.ProxySettings.ProxyAddress),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyServerNameEnvVarName, p.cfg.ProxySettings.ServerName),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyEnabledEnvVarName, strconv.FormatBool(p.cfg.ProxySettings.Enabled)),
			// nolint:staticcheck
			p.envVar(proxy.PluginSecureSocksProxyAllowInsecureEnvVarName, strconv.FormatBool(p.cfg.ProxySettings.AllowInsecure)),
		}
	}
	return nil
}

func (p *EnvVarsProvider) tracingEnvVars(plugin *plugins.Plugin) []string {
	if !p.cfg.Tracing.IsEnabled() {
		return nil
	}

	vars := []string{
		p.envVar("GF_INSTANCE_OTLP_ADDRESS", p.cfg.Tracing.OpenTelemetry.Address),
		p.envVar("GF_INSTANCE_OTLP_PROPAGATION", p.cfg.Tracing.OpenTelemetry.Propagation),
		p.envVar("GF_INSTANCE_OTLP_SAMPLER_TYPE", p.cfg.Tracing.OpenTelemetry.Sampler),
		fmt.Sprintf("GF_INSTANCE_OTLP_SAMPLER_PARAM=%.6f", p.cfg.Tracing.OpenTelemetry.SamplerParam),
		p.envVar("GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL", p.cfg.Tracing.OpenTelemetry.SamplerRemoteURL),
	}
	if plugin.Info.Version != "" {
		vars = append(vars, fmt.Sprintf("GF_PLUGIN_VERSION=%s", plugin.Info.Version))
	}
	return vars
}

func (p *EnvVarsProvider) pluginSettingsEnvVars(pluginID string) []string {
	const customConfigPrefix = "GF_PLUGIN"

	pluginSettings := p.cfg.PluginSettings[pluginID]

	env := make([]string, 0, len(pluginSettings))
	for k, v := range pluginSettings {
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

func (p *EnvVarsProvider) envVar(key, value string) string {
	if strings.Contains(value, "\x00") {
		p.logger.Error("Variable with key '%s' contains NUL", key)
	}
	return fmt.Sprintf("%s=%s", key, value)
}
