package live

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type pluginChannelPublisher struct {
	node *centrifuge.Node
}

func newPluginChannelPublisher(node *centrifuge.Node) *pluginChannelPublisher {
	return &pluginChannelPublisher{node: node}
}

func (p *pluginChannelPublisher) Publish(channel string, data []byte) error {
	_, err := p.node.Publish(channel, data)
	return err
}

type pluginPresenceGetter struct {
	node *centrifuge.Node
}

func newPluginPresenceGetter(node *centrifuge.Node) *pluginPresenceGetter {
	return &pluginPresenceGetter{node: node}
}

func (p *pluginPresenceGetter) GetNumSubscribers(channel string) (int, error) {
	res, err := p.node.PresenceStats(channel)
	if err != nil {
		return 0, err
	}
	return res.NumClients, nil
}

type pluginContextGetter struct {
	PluginManager   plugins.Manager
	Bus             bus.Bus
	Cache           *localcache.CacheService
	DatasourceCache datasources.CacheService
}

func newPluginContextGetter(bus bus.Bus, pluginManager plugins.Manager, cache *localcache.CacheService, datasourceCache datasources.CacheService) *pluginContextGetter {
	return &pluginContextGetter{
		PluginManager:   pluginManager,
		DatasourceCache: datasourceCache,
		Bus:             bus,
		Cache:           cache,
	}
}

func (g *pluginContextGetter) GetPluginContext(ctx context.Context, pluginID string, datasourceUID string) (backend.PluginContext, bool, error) {
	user, ok := getContextSignedUser(ctx)
	if !ok {
		return backend.PluginContext{}, false, fmt.Errorf("no signed user found in context")
	}
	return plugincontext.Get(pluginID, datasourceUID, g.PluginManager, user, g.Cache, g.Bus, g.DatasourceCache)
}
