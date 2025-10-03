package registry

import (
	"context"
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ pluginsapp.PluginRegistry = (*InMemoryAdapter)(nil)
)

// InMemoryAdapter allows the registry to be passed to the plugins app storage without depending on grafana/grafana.
type InMemoryAdapter struct {
	namespaceMapper request.NamespaceMapper
	pluginRegistry  Service
}

func ProvideInMemoryRegistryAdapter(inMemory *InMemory, cfg *setting.Cfg) *InMemoryAdapter {
	return &InMemoryAdapter{
		namespaceMapper: request.GetNamespaceMapper(cfg),
		pluginRegistry:  inMemory,
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
	pluginInstall, err := toPluginInstall(plugin)
	if err != nil {
		log.Error("failed to convert plugin to plugin install", "error", err, "plugin", plugin.ID)
		return nil, false
	}
	return pluginInstall, true
}

func (r *InMemoryAdapter) Plugins(ctx context.Context) []pluginsv0alpha1.PluginInstall {
	plugins := r.pluginRegistry.Plugins(ctx)
	pluginInstalls := make([]pluginsv0alpha1.PluginInstall, 0, len(plugins))
	for _, plugin := range plugins {
		pluginInstall, err := toPluginInstall(plugin)
		if err != nil {
			logging.FromContext(ctx).Error("failed to convert plugin to plugin install", "error", err, "plugin", plugin.ID)
			continue
		}
		pluginInstalls = append(pluginInstalls, *pluginInstall)
	}
	sort.Slice(pluginInstalls, func(i, j int) bool {
		return pluginInstalls[i].Name < pluginInstalls[j].Name
	})
	return pluginInstalls
}

// toPluginInstall converts a plugins.Plugin to a pluginsv0alpha1.PluginInstall
func toPluginInstall(plugin *plugins.Plugin) (*pluginsv0alpha1.PluginInstall, error) {
	name, err := app.ToMetadataName(plugin.ID, plugin.Info.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata name for plugin %s: %w", plugin.ID, err)
	}
	return &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			Id:      plugin.ID,
			Version: plugin.Info.Version,
		},
	}, nil
}
