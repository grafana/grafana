package pipeline

import (
	"context"
	"fmt"

	"github.com/centrifugal/centrifuge"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

type LocalSubscribersDataOutput struct {
	// TODO: refactor to depend on interface (avoid Centrifuge dependency here).
	node *centrifuge.Node
}

func NewLocalSubscribersDataOutput(node *centrifuge.Node) *LocalSubscribersDataOutput {
	return &LocalSubscribersDataOutput{node: node}
}

const DataOutputTypeLocalSubscribers = "localSubscribers"

func (out *LocalSubscribersDataOutput) Type() string {
	return DataOutputTypeLocalSubscribers
}

func (out *LocalSubscribersDataOutput) OutputData(_ context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	channelID := vars.Channel
	channel := orgchannel.PrependOrgID(vars.OrgID, channelID)
	pub := &centrifuge.Publication{
		Data: data,
	}
	err := out.node.Hub().BroadcastPublication(channel, pub, centrifuge.StreamPosition{})
	if err != nil {
		return nil, fmt.Errorf("error publishing %s: %w", string(data), err)
	}
	return nil, nil
}
