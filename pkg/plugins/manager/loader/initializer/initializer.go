package initializer

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type Initializer struct {
	cfg             *config.Cfg
	license         plugins.Licensing
	backendProvider plugins.BackendFactoryProvider
	log             log.Logger
	oauthServer     plugins.OAuth2Service
}

func New(cfg *config.Cfg, backendProvider plugins.BackendFactoryProvider, license plugins.Licensing, oauthServer plugins.OAuth2Service) Initializer {
	return Initializer{
		cfg:             cfg,
		license:         license,
		backendProvider: backendProvider,
		log:             log.New("plugin.initializer"),
		oauthServer:     oauthServer,
	}
}

func (i *Initializer) Initialize(ctx context.Context, p *plugins.Plugin) error {
	if p.Backend {
		backendFactory := i.backendProvider.BackendFactory(ctx, p)
		if backendFactory == nil {
			return fmt.Errorf("could not find backend factory for plugin")
		}

		vars, err := i.envVars(p)
		if err != nil {
			return err
		}
		if backendClient, err := backendFactory(p.ID, p.Logger(), vars); err != nil {
			return err
		} else {
			p.RegisterClient(backendClient)
		}
	}

	return nil
}

func (i *Initializer) envVars(plugin *plugins.Plugin) ([]string, error) {
	hostEnv := []string{
		fmt.Sprintf("GF_VERSION=%s", i.cfg.BuildVersion),
		fmt.Sprintf("GF_APP_URL=%s", i.cfg.AppURL),
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

	if plugin.OauthServiceRegistration != nil {
		vars, err := i.oauth2OnBehalfOfVars(plugin.ID, plugin.OauthServiceRegistration)
		if err != nil {
			return nil, err
		}
		hostEnv = append(hostEnv, vars...)
	}

	hostEnv = append(hostEnv, i.awsEnvVars()...)
	hostEnv = append(hostEnv, azsettings.WriteToEnvStr(i.cfg.Azure)...)
	settings, err := i.getPluginSettings(plugin.ID, i.cfg)
	if err != nil {
		return nil, err
	}
	return settings.asEnvVar("GF_PLUGIN", hostEnv), nil
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

func (i *Initializer) registerService(pluginID string, oauthAppInfo *oauthserver.ExternalServiceRegistration) (*oauthserver.ClientDTO, error) {
	// Note: This generates a new app every time the plugin is loaded
	u := uuid.New().String()
	name := fmt.Sprintf("Test App - %s", u)

	svc := &oauthserver.ExternalServiceRegistration{
		ExternalServiceName:    name,
		Permissions:            oauthAppInfo.Permissions,
		ImpersonatePermissions: oauthAppInfo.ImpersonatePermissions,
		RedirectURI:            oauthAppInfo.RedirectURI,
		Key:                    oauthAppInfo.Key,
	}

	cli, err := i.oauthServer.SaveExternalService(context.Background(), svc)
	if err != nil {
		return nil, err
	}

	return cli, nil
}

func (i *Initializer) getPluginSettings(pluginID string, cfg *config.Cfg) (pluginSettings, error) {
	ps := pluginSettings{}
	for k, v := range cfg.PluginSettings[pluginID] {
		if k == "path" || strings.ToLower(k) == "id" {
			continue
		}
		// Note: This has been disabled in favor of using the plugin.json file
		// if k == "oauth_service_registration" {
		// 	oauthAppInfo := &oauthserver.ExternalServiceRegistration{}
		// 	err := json.Unmarshal([]byte(v), oauthAppInfo)
		// 	if err != nil {
		// 		return nil, err
		// 	}

		// 	cli, err := i.registerService(pluginID, oauthAppInfo)
		// 	if err != nil {
		// 		return nil, err
		// 	}
		// 	ps["app_client_id"] = cli.ID
		// 	ps["app_client_secret"] = cli.Secret
		// 	ps["app_private_key"] = cli.KeyResult.PrivatePem
		// 	continue
		// }
		ps[k] = v
	}

	return ps, nil
}

func (i *Initializer) oauth2OnBehalfOfVars(pluginID string, oauthAppInfo *oauthserver.ExternalServiceRegistration) ([]string, error) {
	var variables []string

	// FIXME: Is the pluginID the correct redirect_uri?
	// At the moment a wrong redirect_uri still works
	redirect_uri := i.cfg.AppURL + "/a/" + pluginID + "/"
	oauthAppInfo.RedirectURI = &redirect_uri

	cli, err := i.registerService(pluginID, oauthAppInfo)
	if err != nil {
		return nil, err
	}

	variables = append(variables, fmt.Sprintf("GF_PLUGIN_APP_CLIENT_ID=%s", cli.ID))
	variables = append(variables, fmt.Sprintf("GF_PLUGIN_APP_CLIENT_SECRET=%s", cli.Secret))
	variables = append(variables, fmt.Sprintf("GF_PLUGIN_APP_PRIVATE_KEY=%s", cli.KeyResult.PrivatePem))

	return variables, nil
}
