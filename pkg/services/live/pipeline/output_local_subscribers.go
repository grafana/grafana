package pipeline

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type LocalSubscribersOutput struct {
	// TODO: refactor to depend on interface (avoid Centrifuge dependency here).
	node *centrifuge.Node
}

func NewLocalSubscribersOutput(node *centrifuge.Node) *LocalSubscribersOutput {
	return &LocalSubscribersOutput{node: node}
}

const OutputTypeLocalSubscribers = "localSubscribers"

func (out *LocalSubscribersOutput) Type() string {
	return OutputTypeLocalSubscribers
}

func (out *LocalSubscribersOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
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
