package router

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type PluginClientProvider = func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error)

// The dependencies are configured at startup and used across all plugins
type PluginDependencies struct {
	PluginSettings pluginsettings.Service
	Unified        resource.ResourceClient
	Decrypter      decrypt.DecryptService
	Tracer         tracing.Tracer             // needed for proxy (legacy)
	Features       featuremgmt.FeatureToggles // needed for proxy (legacy)
	Cfg            *setting.Cfg
}

func newPluginLoader(
	pluginClient plugins.Client,
	contextProvider appplugin.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	acService accesscontrol.Service,
	accessControl accesscontrol.AccessControl,
	unified resource.ResourceClient,
	accessClient types.AccessClient,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
) (RoutesLoader, error) {
	return &PluginLoader{
		pluginClient:    pluginClient,
		contextProvider: contextProvider,
		clientV3Loader:  clientV3Loader,
		pluginSources:   pluginSources,
		acService:       acService,
		accessControl:   accessControl,
		accessClient:    accessClient,
		deps: PluginDependencies{
			PluginSettings: pluginSettings,
			Unified:        unified,
			Decrypter:      decrypter,
			Tracer:         tracer,
			Features:       features,
			Cfg:            cfg,
		},
	}, nil
}

type PluginLoader struct {
	pluginClient    plugins.Client
	contextProvider appplugin.PluginContextWrapper
	clientV3Loader  v3.ClientV3Loader
	pluginSources   sources.Registry
	acService       accesscontrol.Service
	accessControl   accesscontrol.AccessControl
	accessClient    types.AccessClient

	deps PluginDependencies
}

func (pl PluginLoader) Load(ctx context.Context) ([]Backend, error) {
	// Get all apps
	pluginDefs, err := definition.LoadPluginDefinition(ctx, pl.pluginSources, definition.Options{
		Filter: func(jsonData plugins.JSONData) bool {
			if jsonData.Type == plugins.TypeApp {
				// TODO? should we fail more loudly
				if !strings.Contains(jsonData.ID, "-") || strings.Contains(jsonData.ID, ".") || jsonData.ID == "v1" {
					logging.FromContext(ctx).Warn("invalid app plugin id", "pluginId", jsonData.ID)
					return false
				}
				return true
			}
			return false
		},
		Schemas:     true,
		AppManifest: true,
	})

	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	backends := make([]Backend, 0, len(pluginDefs))
	for _, plugin := range pluginDefs {
		if plugin.Manifest == nil {
			continue // not yet supported
		}

		backend, err := NewPluginBackend(plugin,
			func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error) {
				return pl.pluginClient, v3.NewLazyClient(pl.clientV3Loader, plugin.JSONData.ID), nil
			}, pl.deps,
		)
		if err != nil {
			return nil, err
		}
		backends = append(backends, backend)
	}
	return backends, nil
}

func (PluginLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil // TODO? is there a plugin registry with update events?
}

//-----------------------
// BACKEND
//-----------------------

func NewPluginBackend(plugin definition.PluginDefinition, client PluginClientProvider, deps PluginDependencies) (*PluginBackend, error) {
	manifest := plugin.Manifest

	if manifest == nil {
		return nil, fmt.Errorf("only manifests are supported right now")
	}

	group := metav1.APIGroup{
		Name: manifest.Group,
		PreferredVersion: metav1.GroupVersionForDiscovery{
			Version: manifest.PreferredVersion,
		},
		Versions: make([]metav1.GroupVersionForDiscovery, len(manifest.Versions)),
	}
	for i, v := range manifest.Versions {
		group.Versions[i].GroupVersion = manifest.Group + "/" + v.Name
		group.Versions[i].Version = v.Name
	}

	return &PluginBackend{
		key:    "static", // hash the config?
		group:  group,
		plugin: plugin,
		client: client,
		deps:   deps,
	}, nil
}

type PluginBackend struct {
	key   string
	group metav1.APIGroup

	plugin definition.PluginDefinition
	client PluginClientProvider
	deps   PluginDependencies
}

func (b *PluginBackend) Group() metav1.APIGroup {
	return b.group
}

func (b *PluginBackend) Key() string {
	return b.key
}

// Stub for now -- this will create a handler for a given plugin
func (b *PluginBackend) Load(ctx context.Context) (http.Handler, error) {
	clientV2, clientV3, err := b.client(ctx, b.plugin.JSONData.ID)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, _ = w.Write(fmt.Appendf(nil, "TODO: PLUGIN %q\n\n%+v\n\n%T, %T",
			b.group.Name, b.plugin.Manifest,
			clientV2, clientV3,
		))
	}), nil
}
