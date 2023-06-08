package liveplugin

import (
	"context"
	"fmt"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/user"
)

type ChannelLocalPublisher struct {
	node     *centrifuge.Node
	pipeline *pipeline.Pipeline
}

func NewChannelLocalPublisher(node *centrifuge.Node, pipeline *pipeline.Pipeline) *ChannelLocalPublisher {
	return &ChannelLocalPublisher{node: node, pipeline: pipeline}
}

func (p *ChannelLocalPublisher) PublishLocal(channel string, data []byte) error {
	if p.pipeline != nil {
		orgID, channelID, err := orgchannel.StripOrgID(channel)
		if err != nil {
			return err
		}
		ok, err := p.pipeline.ProcessInput(context.Background(), orgID, channelID, data)
		if err != nil {
			return err
		}
		if ok {
			// if rule found – we are done here. If not - fall through and process as usual.
			return nil
		}
	}
	pub := &centrifuge.Publication{
		Data: data,
	}
	err := p.node.Hub().BroadcastPublication(channel, pub, centrifuge.StreamPosition{})
	if err != nil {
		return fmt.Errorf("error publishing %s: %w", string(data), err)
	}
	return nil
}

type NumLocalSubscribersGetter struct {
	node *centrifuge.Node
}

func NewNumLocalSubscribersGetter(node *centrifuge.Node) *NumLocalSubscribersGetter {
	return &NumLocalSubscribersGetter{node: node}
}

func (p *NumLocalSubscribersGetter) GetNumLocalSubscribers(channelID string) (int, error) {
	return p.node.Hub().NumSubscribers(channelID), nil
}

type ContextGetter struct {
	pluginContextProvider *plugincontext.Provider
	dataSourceCache       datasources.CacheService
}

func NewContextGetter(pluginContextProvider *plugincontext.Provider, dataSourceCache datasources.CacheService) *ContextGetter {
	return &ContextGetter{
		pluginContextProvider: pluginContextProvider,
		dataSourceCache:       dataSourceCache,
	}
}

func (g *ContextGetter) GetPluginContext(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, error) {
	if datasourceUID == "" {
		return g.pluginContextProvider.Get(ctx, pluginID, user)
	}

	ds, err := g.dataSourceCache.GetDatasourceByUID(ctx, datasourceUID, user, skipCache)
	if err != nil {
		return backend.PluginContext{}, fmt.Errorf("%v: %w", "Failed to get datasource", err)
	}
	return g.pluginContextProvider.GetWithDataSource(ctx, pluginID, user, ds)
}
