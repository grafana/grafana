package router

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"

	preferencesapp "github.com/grafana/grafana/apps/preferences/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
)

// CoreApp is an app Grafana runs in its own process and serves through the
// router, in place of the group's embedded API server implementation. Its
// client authenticates requests like a plugin process does (see
// v3.NewInProcessClient), so the app acts as the caller as an external one
// would.
type CoreApp struct {
	// PluginID is the app's identity: the audience of the tokens it is called
	// with and the plugin_id its requests are recorded under.
	PluginID string
	Manifest *app.ManifestData
	Client   appclientv3.Client

	// TEMPORARY: what pluginroute answers preferences/merged with. It goes away,
	// with pluginroute's hardcoded getter, once the app manifest can declare a
	// name the app answers itself.
	PreferencesConfig *preferencesapp.Config
}

// coreAppsLoader serves core apps next to the groups of the loader it wraps. A
// core app takes over a group the base loader also serves, like the last of
// several backends for one group does in any other load.
type coreAppsLoader struct {
	base RoutesLoader
	deps PluginDependencies
	apps []CoreApp
}

// newCoreAppsLoader returns base when there are no core apps.
func newCoreAppsLoader(base RoutesLoader, deps PluginDependencies, apps []CoreApp) RoutesLoader {
	if len(apps) == 0 {
		return base
	}
	// Core apps have no plugin settings for the legacy app-access check, and
	// no plugin of their own for it to name. The router has authenticated the
	// caller, and the kind authorizer decides the rest.
	deps.AccessControl = pluginManifestAccessControl{}
	return &coreAppsLoader{base: base, deps: deps, apps: apps}
}

func (l *coreAppsLoader) Load(ctx context.Context) ([]Backend, error) {
	backends, err := l.base.Load(ctx)
	if err != nil {
		return nil, err
	}
	for _, a := range l.apps {
		backend, err := l.backend(a)
		if err != nil {
			// One bad app must not keep the base loader's groups from loading.
			logging.FromContext(ctx).Warn("router: skipping core app", "pluginId", a.PluginID, "err", err)
			continue
		}
		backends = append(backends, backend)
	}
	return backends, nil
}

func (l *coreAppsLoader) backend(a CoreApp) (*PluginBackend, error) {
	if a.Client == nil {
		return nil, fmt.Errorf("core app %q has no client", a.PluginID)
	}
	key, err := json.Marshal(struct {
		PluginID string
		Manifest *app.ManifestData
	}{a.PluginID, a.Manifest})
	if err != nil {
		return nil, err
	}
	client := func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
		return nil, a.Client, nil
	}
	backend, err := newPluginBackend(a.PluginID, a.Manifest, client, l.deps, key)
	if err != nil {
		return nil, err
	}
	backend.source = sourceCore
	backend.preferencesConfig = a.PreferencesConfig
	return backend, nil
}

func (l *coreAppsLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	return l.base.Notify(ctx)
}
