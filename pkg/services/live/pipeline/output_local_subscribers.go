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
	// TODO: refactor to depend on interface.
	node *centrifuge.Node
}

func NewLocalSubscribersOutput(node *centrifuge.Node) *LocalSubscribersOutput {
	return &LocalSubscribersOutput{node: node}
}

func (l *LocalSubscribersOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) error {
	channelID := vars.Channel
	channel := orgchannel.PrependOrgID(vars.OrgID, channelID)
	frameJSON, err := json.Marshal(frame)
	if err != nil {
		return nil
	}
	pub := &centrifuge.Publication{
		Data: frameJSON,
	}
	err = l.node.Hub().BroadcastPublication(channel, pub, centrifuge.StreamPosition{})
	if err != nil {
		return fmt.Errorf("error publishing %s: %w", string(frameJSON), err)
	}
	return nil
}
