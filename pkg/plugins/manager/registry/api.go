package registry

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
)

var _ Service = (*InstallAPIRegistry)(nil)

type InstallAPIRegistry struct {
	clientMu sync.RWMutex
	client   pluginsapp.InstallClient
}

func ProvideInstallAPIRegistry() *InstallAPIRegistry {
	return NewInstallAPIRegistry()
}

func NewInstallAPIRegistry() *InstallAPIRegistry {
	return &InstallAPIRegistry{}
}

func (r *InstallAPIRegistry) getClient() (pluginsapp.InstallClient, error) {
	r.clientMu.RLock()
	if r.client != nil {
		defer r.clientMu.RUnlock()
		return r.client, nil
	}
	r.clientMu.RUnlock()
	return r.initClient()
}

func (r *InstallAPIRegistry) initClient() (pluginsapp.InstallClient, error) {
	r.clientMu.Lock()
	defer r.clientMu.Unlock()
	installClient, err := pluginsapp.NewInstallClient()
	if err != nil {
		return nil, err
	}
	r.client = installClient
	return installClient, nil
}

func (r *InstallAPIRegistry) Plugin(ctx context.Context, id, version string) (*plugins.Plugin, bool) {
	log := logging.FromContext(ctx)
	installClient, err := r.getClient()
	if err != nil {
		log.Error("failed to get install client", "err", err)
		return nil, false
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false
	}

	name, err := app.ToMetadataName(id, version)
	if err != nil {
		return nil, false
	}

	pluginInstall, err := installClient.Get(ctx, resource.Identifier{
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

func (r *InstallAPIRegistry) Plugins(ctx context.Context) []*plugins.Plugin {
	log := logging.FromContext(ctx)
	installClient, err := r.getClient()
	if err != nil {
		log.Error("failed to get install client", "err", err)
		return nil
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil
	}

	pluginInstalls, err := installClient.List(ctx, resource.StoreListOptions{
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

func (r *InstallAPIRegistry) Add(ctx context.Context, plugin *plugins.Plugin) error {
	installClient, err := r.getClient()
	if err != nil {
		return err
	}
	pluginInstall := toPluginInstall(plugin)
	_, err = installClient.Add(ctx, pluginInstall)
	return err
}

func (r *InstallAPIRegistry) Remove(ctx context.Context, id, version string) error {
	installClient, err := r.getClient()
	if err != nil {
		return err
	}
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	name, err := app.ToMetadataName(id, version)
	if err != nil {
		return err
	}

	return installClient.Delete(ctx, resource.Identifier{
		Namespace: requester.GetNamespace(),
		Name:      name,
	})
}

func (r *InstallAPIRegistry) Enabled() (bool, error) {
	_, err := r.getClient()
	if err != nil {
		if errors.Is(err, pluginsapp.ErrInstallAPINotEnabled) {
			return false, nil
		}
		return false, err
	}
	return true, nil
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
