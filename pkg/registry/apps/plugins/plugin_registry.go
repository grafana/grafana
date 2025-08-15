package plugins

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

var _ registry.Service = (*InstallAPIRegistryProvider)(nil)

type InstallAPIRegistryProvider struct {
	installClient pluginsapp.InstallClient
}

func NewAPIRegistryProvider() (*InstallAPIRegistryProvider, error) {
	installClient, err := pluginsapp.NewInstallClient()
	if err != nil {
		return nil, err
	}
	return &InstallAPIRegistryProvider{
		installClient: installClient,
	}, nil
}

func (r *InstallAPIRegistryProvider) Plugin(ctx context.Context, id, version string) (*plugins.Plugin, bool) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false
	}

	name, err := app.ToMetadataName(id, version)
	if err != nil {
		return nil, false
	}

	pluginInstall, err := r.installClient.Get(ctx, resource.Identifier{
		Namespace: requester.GetNamespace(),
		Name:      name,
	})
	if err != nil {
		return nil, false
	}
	plugin, err := fromPluginInstall(pluginInstall)
	if err != nil {
		return nil, false
	}
	return plugin, true
}

func (r *InstallAPIRegistryProvider) Plugins(ctx context.Context) []*plugins.Plugin {
	log := logging.FromContext(ctx)
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil
	}

	pluginInstalls, err := r.installClient.List(ctx, resource.StoreListOptions{
		Namespace: requester.GetNamespace(),
	})
	if err != nil {
		return nil
	}

	plugins := make([]*plugins.Plugin, 0, len(pluginInstalls.Items))
	for _, pluginInstall := range pluginInstalls.Items {
		plugin, err := fromPluginInstall(pluginInstall)
		if err != nil {
			log.Error("failed to convert plugin install to plugin", "err", err, "plugin", pluginInstall.Name)
			continue
		}
		plugins = append(plugins, plugin)
	}

	return plugins
}

func (r *InstallAPIRegistryProvider) Add(ctx context.Context, plugin *plugins.Plugin) error {
	pluginInstall := toPluginInstall(plugin)
	_, err := r.installClient.Add(ctx, pluginInstall)
	return err
}

func (r *InstallAPIRegistryProvider) Remove(ctx context.Context, id, version string) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	name, err := app.ToMetadataName(id, version)
	if err != nil {
		return err
	}

	return r.installClient.Delete(ctx, resource.Identifier{
		Namespace: requester.GetNamespace(),
		Name:      name,
	})
}

func fromPluginInstall(pluginInstall *pluginsv0alpha1.PluginInstall) (*plugins.Plugin, error) {
	id, version, ok := app.FromMetadataName(pluginInstall.Name)
	if !ok {
		return nil, fmt.Errorf("invalid plugin name: %s", pluginInstall.Name)
	}

	return &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: id,
			Info: plugins.Info{
				Version: version,
			},
		},
	}, nil
}
