package envvars

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

type Provider interface {
	Get(ctx context.Context, p *plugins.Plugin) ([]string, error)
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

func (s *Service) Get(ctx context.Context, p *plugins.Plugin) ([]string, error) {
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

	hostEnv = append(hostEnv, s.awsEnvVars()...)
	hostEnv = append(hostEnv, s.secureSocksProxyEnvVars()...)
	hostEnv = append(hostEnv, azsettings.WriteToEnvStr(s.cfg.Azure)...)
	hostEnv = append(hostEnv, s.tracingEnvVars(p)...)

	ev := getPluginSettings(p.ID, s.cfg).asEnvVar("GF_PLUGIN", hostEnv)
	return ev, nil
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

func (s *Service) awsEnvVars() []string {
	var variables []string
	if s.cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(s.cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(s.cfg.AWSAllowedAuthProviders, ","))
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

func (ps pluginSettings) asEnvVar(prefix string, hostEnv []string) []string {
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
