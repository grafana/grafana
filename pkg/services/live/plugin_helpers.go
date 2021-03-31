package live

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/schema"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
)

type pluginPacketSender struct {
	node        *centrifuge.Node
	schemaCache *schema.Cache
}

func newPluginPacketSender(node *centrifuge.Node, schemaCache *schema.Cache) *pluginPacketSender {
	return &pluginPacketSender{node: node, schemaCache: schemaCache}
}

func (p *pluginPacketSender) Send(channel string, packet *backend.StreamPacket) error {
	if packet.Type == 0 {
		// Custom logic for data frame packet processing.
		if packet.Header != nil {
			_ = p.schemaCache.Update(channel, packet.Header)
			_, _ = p.node.Publish(channel, packet.Header)
			if packet.Payload != nil {
				_, _ = p.node.Publish(channel, packet.Payload)
			}
			return nil
		}
		_, err := p.node.Publish(channel, packet.Payload)
		return err
	}
	// For all other packet types just send a payload.
	_, err := p.node.Publish(channel, packet.Payload)
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
	PluginContextProvider *plugincontext.Provider
}

func newPluginContextGetter(pluginContextProvider *plugincontext.Provider) *pluginContextGetter {
	return &pluginContextGetter{
		PluginContextProvider: pluginContextProvider,
	}
}

func (g *pluginContextGetter) GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string) (backend.PluginContext, bool, error) {
	return g.PluginContextProvider.Get(pluginID, datasourceUID, user)
}
