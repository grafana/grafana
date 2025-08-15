package plugins

import (
	"context"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

var (
	_ pluginsapp.PluginRegistry = (*InMemoryRegistryAdapter)(nil)
)

type InMemoryRegistryAdapter struct {
	pluginRegistry registry.Service
}

func NewInMemoryRegistryAdapter(pluginRegistry registry.Service) *InMemoryRegistryAdapter {
	return &InMemoryRegistryAdapter{
		pluginRegistry: pluginRegistry,
	}
}

func (r *InMemoryRegistryAdapter) Plugin(ctx context.Context, name string) (*pluginsv0alpha1.PluginInstall, bool) {
	plugin, ok := r.pluginRegistry.Plugin(ctx, name, "")
	if !ok {
		return nil, false
	}
	return toPluginInstall(plugin), true
}

func (r *InMemoryRegistryAdapter) Plugins(ctx context.Context) []pluginsv0alpha1.PluginInstall {
	plugins := r.pluginRegistry.Plugins(ctx)
	pluginInstalls := make([]pluginsv0alpha1.PluginInstall, 0, len(plugins))
	for _, plugin := range plugins {
		pluginInstalls = append(pluginInstalls, *toPluginInstall(plugin))
	}
	sort.Slice(pluginInstalls, func(i, j int) bool {
		return pluginInstalls[i].Spec.Id < pluginInstalls[j].Spec.Id
	})
	return pluginInstalls
}

func toPluginInstall(plugin *plugins.Plugin) *pluginsv0alpha1.PluginInstall {
	return &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Name: plugin.ID,
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			Id:      plugin.ID,
			Version: plugin.Info.Version,
		},
	}
}

// TODO
type InstallAPIRegistryProvider struct {
	installClient pluginsapp.InstallClient
}

func NewAPIRegistryProvider() *InstallAPIRegistryProvider {
	return nil
}

func fromPluginInstall(pluginInstall *pluginsv0alpha1.PluginInstall) *plugins.Plugin {
	return &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginInstall.Spec.Id,
			Info: plugins.Info{
				Version: pluginInstall.Spec.Version,
			},
		},
	}
}
