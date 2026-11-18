package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/client-go/rest"

	"github.com/grafana/authlib/authn"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana-app-sdk/plugin/appadapter"
	"github.com/grafana/grafana-app-sdk/simple"

	collectionsmanifest "github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
	collectionsapp "github.com/grafana/grafana/apps/collections/pkg/app"
	preferencesmanifest "github.com/grafana/grafana/apps/preferences/pkg/apis/manifestdata"
	preferencesapp "github.com/grafana/grafana/apps/preferences/pkg/app"
	"github.com/grafana/grafana/pkg/apiserver/appsdk"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	prefsapi "github.com/grafana/grafana/pkg/registry/apis/preferences"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

// registerCoreAPIs reports whether the router serves the core apps' groups.
// Like settingsEnabled, it is evaluated through OpenFeature, so a remote
// provider can turn it on without a [feature_toggles] entry, and it is read
// once, at startup.
func registerCoreAPIs() bool {
	ctx := context.Background()
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagRouterRegisterCoreAPIs, false, openfeature.TransactionContext(ctx))
}

// coreAppsFromInstallers builds a core app for each installer, and for the
// apps in directInstallers. They call Grafana's API like an
// external app plugin does: through the local token exchange, as the caller. An
// installer that cannot be served is skipped with a warning, so one bad app
// does not leave the others unserved.
func coreAppsFromInstallers(ctx context.Context, installers []appsdk.AppInstaller, cfg *setting.Cfg, pluginAuth *pluginauth.Config) ([]CoreApp, error) {
	if !pluginAuth.LocalTokens() || pluginAuth.LocalAPIURL() == "" {
		return nil, fmt.Errorf("%s needs Grafana to sign plugin tokens itself, and a local API URL to reach", featuremgmt.FlagRouterRegisterCoreAPIs)
	}

	log := logging.FromContext(ctx)

	installers = append(directInstallers(ctx, cfg), installers...)

	apps := make([]CoreApp, 0, len(installers))
	for _, installer := range installers {
		if installer == nil || installer.ManifestData() == nil {
			continue
		}
		coreApp, err := newCoreAppFromInstaller(installer, pluginAuth)
		if err != nil {
			log.Warn("router: skipping core app installer", "group", installer.ManifestData().Group, "err", err)
			continue
		}
		apps = append(apps, coreApp)
	}
	return apps, nil
}

// directInstallers are the installers of the apps the embedded API server has
// no installer for: it serves their groups from its own builders, so the router
// adds them here. An app that cannot be installed is skipped with a warning.
func directInstallers(ctx context.Context, cfg *setting.Cfg) []appsdk.AppInstaller {
	log := logging.FromContext(ctx)
	installers := []appsdk.AppInstaller{}

	collectionsManifest := collectionsmanifest.LocalManifest()
	collections, err := appsdk.NewDefaultAppInstaller(
		simple.NewAppProvider(collectionsManifest, nil, collectionsapp.New),
		app.Config{
			KubeConfig:   rest.Config{}, // replaced when the installer initializes the app
			ManifestData: *collectionsManifest.ManifestData,
		},
		collectionsmanifest.NewGoTypeAssociator(),
	)
	if err != nil {
		log.Warn("router: skipping the collections app", "err", err)
	} else {
		installers = append(installers, collections)
	}

	// Without its config the app has no defaults to merge, and accepts any theme.
	preferencesConfig := &preferencesapp.Config{
		Defaults:          prefsapi.DefaultSpec(cfg),
		HomeDashboardName: home.DASHBOARD_NAME,
		IsValidTheme:      pref.IsValidThemeID,
	}
	preferencesManifest := preferencesmanifest.LocalManifest()
	preferences, err := appsdk.NewDefaultAppInstaller(
		simple.NewAppProvider(preferencesManifest, preferencesConfig, preferencesapp.New),
		app.Config{
			KubeConfig:     rest.Config{}, // replaced when the installer initializes the app
			ManifestData:   *preferencesManifest.ManifestData,
			SpecificConfig: preferencesConfig,
		},
		preferencesmanifest.NewGoTypeAssociator(),
	)
	if err != nil {
		log.Warn("router: skipping the preferences app", "err", err)
	} else {
		installers = append(installers, preferences)
	}

	return installers
}

// coreAppPluginID names the identity a core app is called with, from its API
// group: playlist.grafana.app is grafana-playlist-app.
func coreAppPluginID(group string) string {
	name, _, _ := strings.Cut(group, ".")
	return "grafana-" + name + "-app"
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

// ownAccessActions are what a core app may do with the kinds of its own group.
// A list or watch needs get, as the router's authorizer checks.
var ownAccessActions = []app.KindPermissionAction{"get", "create", "update", "delete"}

// withOwnAccessKinds returns a copy of manifest that also requests access to
// the kinds of its own group. The local token exchange grants an app its own
// group only when that group is a plugin group (*.ext.grafana.app); a core
// app's group must be requested as an access kind, or its own reflectors are
// forbidden from listing its kinds. The copy is for issuing the app's token:
// the manifest the router serves is left as it is.
func withOwnAccessKinds(manifest *app.ManifestData) *app.ManifestData {
	out := *manifest
	perms := app.Permissions{}
	if manifest.ExtraPermissions != nil {
		perms.AccessKinds = slices.Clone(manifest.ExtraPermissions.AccessKinds)
	}
	for _, resource := range slices.Sorted(maps.Values(kindResourceNames(manifest))) {
		if slices.ContainsFunc(perms.AccessKinds, func(k app.KindPermission) bool {
			return k.Group == manifest.Group && k.Resource == resource
		}) {
			continue // the manifest asks for it itself
		}
		perms.AccessKinds = append(perms.AccessKinds, app.KindPermission{
			Group: manifest.Group, Resource: resource, Actions: slices.Clone(ownAccessActions),
		})
	}
	out.ExtraPermissions = &perms
	return &out
}

// newCoreAppFromInstaller initializes the installer's app with credentials to
// call Grafana's API as the caller, and serves it from an in-process client.
// An app the embedded API server initialized first keeps that configuration.
func newCoreAppFromInstaller(installer appsdk.AppInstaller, pluginAuth *pluginauth.Config) (CoreApp, error) {
	manifest, err := routerManifest(installer.ManifestData())
	if err != nil {
		return CoreApp{}, err
	}
	pluginID := coreAppPluginID(manifest.Group)

	policyManifest := withOwnAccessKinds(manifest)
	token, err := v3.IssueLocalAccessPolicyToken(pluginID, policyManifest)
	if err != nil {
		return CoreApp{}, err
	}
	apiURL := pluginAuth.LocalAPIURL()
	var kubeConfig *rest.Config
	kubeConfig, err = k8s.NewTokenExchangeRestConfig(
		k8s.TokenExchangeCredentials{Token: token, TokenExchangeURL: apiURL + pluginauth.TokenExchangePath},
		k8s.RemoteServiceTarget{Host: apiURL, Audiences: plugin.TokenExchangeAudiences(*policyManifest)},
	)
	if err != nil {
		return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
	}
	if err := installer.InitializeApp(*kubeConfig); err != nil && !errors.Is(err, appsdk.ErrAppAlreadyInitialized) {
		return CoreApp{}, fmt.Errorf("%s: %w", pluginID, err)
	}
	a, err := installer.App()
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
