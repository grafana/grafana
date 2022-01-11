package liveplugin

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/pipeline"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.runstream")
)

type ChannelLocalPublisher struct {
	node              *centrifuge.Node
	pipeline          *pipeline.Pipeline
	channelLeaderMode bool
}

func NewChannelLocalPublisher(node *centrifuge.Node, pipeline *pipeline.Pipeline, channelLeaderMode bool) *ChannelLocalPublisher {
	return &ChannelLocalPublisher{node: node, pipeline: pipeline, channelLeaderMode: channelLeaderMode}
}

func (p *ChannelLocalPublisher) PublishLocal(channel string, data []byte, leadershipID string) error {
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
	var err error
	if p.channelLeaderMode {
		logger.Debug("Publish into channel in leader mode", "channel", channel, "lid", leadershipID)
		_, err = p.node.Publish(channel, data,
			centrifuge.WithEpoch(leadershipID),
			centrifuge.WithHistory(1, time.Hour),
		)
	} else {
		pub := &centrifuge.Publication{
			Data: data,
		}
		err = p.node.Hub().BroadcastPublication(channel, pub, centrifuge.StreamPosition{})
	}
	if err != nil {
		return fmt.Errorf("error publishing %s: %w", string(data), err)
	}
	return nil
}

type NumSubscribersGetter struct {
	node *centrifuge.Node
}

func NewNumSubscribersGetter(node *centrifuge.Node) *NumSubscribersGetter {
	return &NumSubscribersGetter{node: node}
}

func (p *NumSubscribersGetter) GetNumLocalSubscribers(channelID string) (int, error) {
	return p.node.Hub().NumSubscribers(channelID), nil
}

func (p *NumSubscribersGetter) GetNumSubscribers(channelID string) (int, error) {
	presenceStats, err := p.node.PresenceStats(channelID)
	if err != nil {
		return 0, err
	}
	return presenceStats.NumClients, nil
}

type ContextGetter struct {
	PluginContextProvider *plugincontext.Provider
}

func NewContextGetter(pluginContextProvider *plugincontext.Provider) *ContextGetter {
	return &ContextGetter{
		PluginContextProvider: pluginContextProvider,
	}
}

func (g *ContextGetter) GetPluginContext(ctx context.Context, user *models.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
	return g.PluginContextProvider.Get(ctx, pluginID, datasourceUID, user, skipCache)
}
