package initializer

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Initializer struct {
	cfg             *config.Cfg
	license         plugins.Licensing
	backendProvider plugins.BackendFactoryProvider
	log             log.Logger
}

func New(cfg *config.Cfg, backendProvider plugins.BackendFactoryProvider, license plugins.Licensing) Initializer {
	return Initializer{
		cfg:             cfg,
		license:         license,
		backendProvider: backendProvider,
		log:             log.New("plugin.initializer"),
	}
}

func (i *Initializer) Initialize(ctx context.Context, p *plugins.Plugin) error {
	if p.Backend {
		backendFactory := i.backendProvider.BackendFactory(ctx, p)
		if backendFactory == nil {
			return fmt.Errorf("could not find backend factory for plugin")
		}

		if backendClient, err := backendFactory(p.ID, p.Logger(), i.envVars(p)); err != nil {
			return err
		} else {
			p.RegisterClient(backendClient)
		}
	}

	return nil
}

func (i *Initializer) envVars(plugin *plugins.Plugin) []string {
	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", i.cfg.BuildVersion),
	}

	if i.license != nil {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_EDITION=%s", i.license.Edition()),
			fmt.Sprintf("GF_ENTERPRISE_LICENSE_PATH=%s", i.license.Path()),
			fmt.Sprintf("GF_ENTERPRISE_APP_URL=%s", i.license.AppURL()),
		)
		hostEnv = append(hostEnv, i.license.Environment()...)
	}

	hostEnv = append(hostEnv, i.awsEnvVars()...)
	hostEnv = append(hostEnv, azsettings.WriteToEnvStr(i.cfg.Azure)...)

	// Tracing
	if i.cfg.Tracing.Enabled {
		hostEnv = append(
			hostEnv,
			fmt.Sprintf("GF_INSTANCE_OTLP_ADDRESS=%s", i.cfg.Tracing.OpenTelemetry.Address),
			fmt.Sprintf("GF_INSTANCE_OTLP_PROPAGATION=%s", i.cfg.Tracing.OpenTelemetry.Propagation),
		)
		if plugin.Info.Version != "" {
			hostEnv = append(hostEnv, fmt.Sprintf("GF_PLUGIN_VERSION=%s", plugin.Info.Version))
		}
	}

	ev := getPluginSettings(plugin.ID, i.cfg).asEnvVar("GF_PLUGIN", hostEnv)
	return ev
}

func (i *Initializer) awsEnvVars() []string {
	var variables []string
	if i.cfg.AWSAssumeRoleEnabled {
		variables = append(variables, awsds.AssumeRoleEnabledEnvVarKeyName+"=true")
	}
	if len(i.cfg.AWSAllowedAuthProviders) > 0 {
		variables = append(variables, awsds.AllowedAuthProvidersEnvVarKeyName+"="+strings.Join(i.cfg.AWSAllowedAuthProviders, ","))
	}

	return variables
}

type pluginSettings map[string]string

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
