package liveplugin

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type ChannelLocalPublisher struct {
	node *centrifuge.Node
}

func NewChannelLocalPublisher(node *centrifuge.Node) *ChannelLocalPublisher {
	return &ChannelLocalPublisher{node: node}
}

func (p *ChannelLocalPublisher) PublishLocal(channel string, data []byte) error {
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
	PluginContextProvider *plugincontext.Provider
}

func NewContextGetter(pluginContextProvider *plugincontext.Provider) *ContextGetter {
	return &ContextGetter{
		PluginContextProvider: pluginContextProvider,
	}
}

func (g *ContextGetter) GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
	return g.PluginContextProvider.Get(pluginID, datasourceUID, user, skipCache)
}
