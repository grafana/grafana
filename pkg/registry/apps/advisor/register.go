package advisor

import (
	"crypto/tls"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/client-go/rest"
)

type AdvisorAppProvider struct {
	app.Provider
}

// remoteAdvisorSettings defines the settings for the remote advisor client
type remoteAdvisorSettings struct {
	Enabled       bool
	URL           string
	Token         string
	Timeout       time.Duration
	SkipTLSVerify bool
}

func parseRemoteAdvisorSettings(pluginConfig map[string]string) *remoteAdvisorSettings {
	timeout, err := time.ParseDuration(pluginConfig["remote_timeout"])
	if err != nil {
		timeout = 30 * time.Second
	}
	return &remoteAdvisorSettings{
		Enabled:       pluginConfig["remote_enabled"] == "true",
		URL:           pluginConfig["remote_url"],
		Token:         pluginConfig["remote_token"],
		Timeout:       timeout,
		SkipTLSVerify: pluginConfig["remote_skip_tls_verify"] == "true",
	}
}

func RegisterApp(
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{}
	log := logging.DefaultLogger.With("app", "advisor.register")
	remoteCfg := parseRemoteAdvisorSettings(cfg.PluginSettings["grafana-advisor-app"])

	// Check if remote advisor is configured
	if remoteCfg.Enabled {
		log.Info("Remote advisor API server is enabled", "url", remoteCfg.URL)
		return createRemoteAdvisorProvider(provider, remoteCfg, checkRegistry, cfg)
	}

	// Fall back to local implementation
	log.Info("Using local advisor implementation")
	return createLocalAdvisorProvider(provider, checkRegistry, cfg)
}

func createRemoteAdvisorProvider(
	provider *AdvisorAppProvider,
	remoteCfg *remoteAdvisorSettings,
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
) *AdvisorAppProvider {
	pluginConfig := cfg.PluginSettings["grafana-advisor-app"]
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
		PluginConfig:  pluginConfig,
		StackID:       cfg.StackID,
	}

	// Create a custom app config that uses the remote client's Kubernetes config
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:         advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:             advisorapp.GetKinds(),
		Authorizer:               advisorapp.GetAuthorizer(),
		CustomConfig:             any(specificConfig),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}

	// Create app factory that uses remote client
	appFactory := func(appConfig app.Config) (app.App, error) {
		// Create a remote Kubernetes configuration
		// Use custom transport that includes both auth and TLS settings
		transport := &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: remoteCfg.SkipTLSVerify,
			},
		}

		remoteConfig := rest.Config{
			Host:    remoteCfg.URL,
			APIPath: "/apis", // Important: set the correct API path for K8s resources
			Transport: &authTransport{
				base:  transport,
				token: remoteCfg.Token,
			},
			Timeout: remoteCfg.Timeout,
			// Don't set TLSClientConfig here since we handle TLS in the custom transport
		}

		// Override the app config to use remote API server
		remoteAppConfig := appConfig
		remoteAppConfig.KubeConfig = remoteConfig

		return advisorapp.New(remoteAppConfig)
	}

	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, appFactory)
	return provider
}

// authTransport adds authentication to HTTP requests
type authTransport struct {
	base  http.RoundTripper
	token string
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.token != "" {
		req.Header.Set("Authorization", "Bearer "+t.token)
	}
	return t.base.RoundTrip(req)
}

func createLocalAdvisorProvider(
	provider *AdvisorAppProvider,
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
) *AdvisorAppProvider {
	pluginConfig := cfg.PluginSettings["grafana-advisor-app"]
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
		PluginConfig:  pluginConfig,
		StackID:       cfg.StackID,
	}

	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:         advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:             advisorapp.GetKinds(),
		Authorizer:               advisorapp.GetAuthorizer(),
		CustomConfig:             any(specificConfig),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}

	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}
