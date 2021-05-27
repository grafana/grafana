package live

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
)

type pluginChannelSender struct {
	node *centrifuge.Node
}

func newPluginChannelSender(node *centrifuge.Node) *pluginChannelSender {
	return &pluginChannelSender{node: node}
}

func (p *pluginChannelSender) Send(channel string, data []byte) error {
	_, err := p.node.Publish(channel, data)
	if err != nil {
		return fmt.Errorf("error publishing %s: %w", string(data), err)
	}
	return nil
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
	PluginContextProvider *plugincontext.Provider
}

func newPluginContextGetter(pluginContextProvider *plugincontext.Provider) *pluginContextGetter {
	return &pluginContextGetter{
		PluginContextProvider: pluginContextProvider,
	}
}

func (g *pluginContextGetter) GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
	return g.PluginContextProvider.Get(pluginID, datasourceUID, user, skipCache)
}
