package router

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/client-go/rest"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/plugin/appadapter"

	collectionsmanifest "github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
	collectionsapp "github.com/grafana/grafana/apps/collections/pkg/app"
	preferencesmanifest "github.com/grafana/grafana/apps/preferences/pkg/apis/manifestdata"
	preferencesapp "github.com/grafana/grafana/apps/preferences/pkg/app"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	prefsapi "github.com/grafana/grafana/pkg/registry/apis/preferences"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

// Plugin IDs of the apps the router serves from this process. They are what the
// tokens the apps are called with are addressed to.
const (
	collectionsPluginID = "grafana-collections-app"
	preferencesPluginID = "grafana-preferences-app"
)

// routeCollectionsAndPreferences reports whether the router serves
// collections.grafana.app and preferences.grafana.app, in place of the embedded
// API server. Like settingsEnabled, it is evaluated through OpenFeature, so a
// remote provider can turn it on without a [feature_toggles] entry, and it is
// read once, at startup.
func routeCollectionsAndPreferences() bool {
	ctx := context.Background()
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaRoutePreferencesAndCollections, false, openfeature.TransactionContext(ctx))
}

// builtinCoreApps builds the apps behind grafana.routePreferencesAndCollections.
// They call Grafana's API like an external app plugin does: through the local
// token exchange, as the caller. They fail startup rather than leave their
// groups unserved when that is not possible.
func builtinCoreApps(cfg *setting.Cfg, pluginAuth *pluginauth.Config) ([]CoreApp, error) {
	if !routeCollectionsAndPreferences() {
		return nil, nil
	}
	if !pluginAuth.LocalTokens() || pluginAuth.LocalAPIURL() == "" {
		return nil, fmt.Errorf("%s needs Grafana to sign plugin tokens itself, and a local API URL to reach", featuremgmt.FlagGrafanaRoutePreferencesAndCollections)
	}

	// Stars write through Grafana's API as the caller. Preferences only validate
	// what is written to them, and are asked for no other object.
	collections, err := newCoreApp(collectionsPluginID, collectionsmanifest.LocalManifest().ManifestData, pluginAuth, true,
		func(c app.Config) (app.App, error) { return collectionsapp.New(c) }, nil)
	if err != nil {
		return nil, err
	}
	preferences, err := newCoreApp(preferencesPluginID, preferencesmanifest.LocalManifest().ManifestData, pluginAuth, false,
		func(c app.Config) (app.App, error) { return preferencesapp.New(c) },
		&preferencesapp.Config{
			Defaults:          prefsapi.DefaultSpec(cfg),
			HomeDashboardName: home.DASHBOARD_NAME,
			IsValidTheme:      pref.IsValidThemeID,
		})
	if err != nil {
		return nil, err
	}
	return []CoreApp{collections, preferences}, nil
}

// routerManifest is a copy of a generated manifest as the router serves it: the
// deprecated routes moved to the OpenAPI paths, as when it is loaded from JSON.
// The copy leaves the shared generated manifest as it is.
func routerManifest(generated *app.ManifestData) (*app.ManifestData, error) {
	raw, err := json.Marshal(generated)
	if err != nil {
		return nil, err
	}
	manifest := &app.ManifestData{}
	if err := json.Unmarshal(raw, manifest); err != nil {
		return nil, err
	}
	definition.MigrateDeprecatedRoutes(manifest)
	return manifest, nil
}

// newCoreApp builds an app and the in-process client that serves it. An app
// that callsAPI gets credentials to call Grafana's API as the caller.
func newCoreApp(pluginID string, generated *app.ManifestData, pluginAuth *pluginauth.Config, callsAPI bool, newApp func(app.Config) (app.App, error), specific any) (CoreApp, error) {
	manifest, err := routerManifest(generated)
	if err != nil {
		return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
	}
	var kubeConfig rest.Config
	if callsAPI {
		token, err := v3.IssueLocalAccessPolicyToken(pluginID, manifest)
		if err != nil {
			return CoreApp{}, err
		}
		apiURL := pluginAuth.LocalAPIURL()
		config, err := k8s.NewTokenExchangeRestConfig(
			k8s.TokenExchangeCredentials{Token: token, TokenExchangeURL: apiURL + pluginauth.TokenExchangePath},
			k8s.RemoteServiceTarget{Host: apiURL, Audiences: plugin.TokenExchangeAudiences(*manifest)},
		)
		if err != nil {
			return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
		}
		kubeConfig = *config
	}
	a, err := newApp(app.Config{KubeConfig: kubeConfig, ManifestData: *manifest, SpecificConfig: specific})
	if err != nil {
		return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
	}

	keys, err := v3.LocalKeyRetriever()
	if err != nil {
		return CoreApp{}, err
	}
	opts := appadapter.ServeOpts(a)
	opts.PluginID = pluginID
	opts.Authenticator = authn.NewAccessTokenAuthenticator(authn.NewAccessTokenVerifier(
		authn.VerifierConfig{AllowedAudiences: []string{pluginID, manifest.Group}}, keys))
	client, _, err := v3.NewInProcessClient(opts) // lives as long as the process
	if err != nil {
		return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
	}
	return CoreApp{PluginID: pluginID, Manifest: manifest, Client: client}, nil
}
