package pipeline

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

type LocalSubscribersFrameOutput struct {
	// TODO: refactor to depend on interface (avoid Centrifuge dependency here).
	node *centrifuge.Node
}

func NewLocalSubscribersFrameOutput(node *centrifuge.Node) *LocalSubscribersFrameOutput {
	return &LocalSubscribersFrameOutput{node: node}
}

const FrameOutputTypeLocalSubscribers = "localSubscribers"

func (out *LocalSubscribersFrameOutput) Type() string {
	return FrameOutputTypeLocalSubscribers
}

func (out *LocalSubscribersFrameOutput) OutputFrame(_ context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	channelID := vars.Channel
	channel := orgchannel.PrependOrgID(vars.OrgID, channelID)
	frameJSON, err := json.Marshal(frame)
	if err != nil {
		return nil, err
	}
	pub := &centrifuge.Publication{
		Data: frameJSON,
	}
	err = out.node.Hub().BroadcastPublication(channel, pub, centrifuge.StreamPosition{})
	if err != nil {
		return nil, fmt.Errorf("error publishing %s: %w", string(frameJSON), err)
	}
	return nil, nil
}
