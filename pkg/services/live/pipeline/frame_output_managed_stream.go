package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/live/managedstream"
)

type ManagedStreamFrameOutput struct {
	managedStream *managedstream.Runner
}

func NewManagedStreamFrameOutput(managedStream *managedstream.Runner) *ManagedStreamFrameOutput {
	return &ManagedStreamFrameOutput{managedStream: managedStream}
}

const FrameOutputTypeManagedStream = "managedStream"

func (out *ManagedStreamFrameOutput) Type() string {
	return FrameOutputTypeManagedStream
}

func (out *ManagedStreamFrameOutput) OutputFrame(ctx context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	stream, err := out.managedStream.GetOrCreateStream(vars.OrgID, vars.Scope, vars.Namespace)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return nil, err
	}
	return nil, stream.Push(ctx, vars.Path, frame)
}
