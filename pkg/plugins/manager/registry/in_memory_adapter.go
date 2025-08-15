package registry

import (
	"context"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
)

var (
	_ pluginsapp.PluginRegistry = (*InMemoryAdapter)(nil)
)

// InMemoryAdapter allows the registry to be passed to the plugins app storage without depending on grafana/grafana.
type InMemoryAdapter struct {
	pluginRegistry Service
}

func ProvideInMemoryRegistryAdapter(pluginRegistry Service) *InMemoryAdapter {
	return &InMemoryAdapter{
		pluginRegistry: pluginRegistry,
	}
}

func (r *InMemoryAdapter) Plugin(ctx context.Context, name string) (*pluginsv0alpha1.PluginInstall, bool) {
	log := logging.FromContext(ctx)
	id, version, ok := app.FromMetadataName(name)
	if !ok {
		log.Error("invalid plugin name", "name", name)
		return nil, false
	}

	plugin, ok := r.pluginRegistry.Plugin(ctx, id, version)
	if !ok {
		log.Error("plugin not found", "name", name)
		return nil, false
	}
	return toPluginInstall(plugin), true
}

func (r *InMemoryAdapter) Plugins(ctx context.Context) []pluginsv0alpha1.PluginInstall {
	plugins := r.pluginRegistry.Plugins(ctx)
	pluginInstalls := make([]pluginsv0alpha1.PluginInstall, 0, len(plugins))
	for _, plugin := range plugins {
		pluginInstall := toPluginInstall(plugin)
		if pluginInstall != nil {
			pluginInstalls = append(pluginInstalls, *pluginInstall)
		}
	}
	sort.Slice(pluginInstalls, func(i, j int) bool {
		return pluginInstalls[i].Name < pluginInstalls[j].Name
	})
	return pluginInstalls
}

func toPluginInstall(plugin *plugins.Plugin) *pluginsv0alpha1.PluginInstall {
	name, err := app.ToMetadataName(plugin.ID, plugin.Info.Version)
	if err != nil {
		return nil
	}
	return &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			Id:      plugin.ID,
			Version: plugin.Info.Version,
		},
	}
}
