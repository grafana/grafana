package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MultipleFrameOutput can combine several FrameOutputter and
// execute them sequentially.
type MultipleFrameOutput struct {
	Outputters []FrameOutputter
}

const FrameOutputTypeMultiple = "multiple"

func (out *MultipleFrameOutput) Type() string {
	return FrameOutputTypeMultiple
}

func (out MultipleFrameOutput) OutputFrame(ctx context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	var frames []*ChannelFrame
	for _, out := range out.Outputters {
		f, err := out.OutputFrame(ctx, vars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return nil, err
		}
		frames = append(frames, f...)
	}
	return frames, nil
}

func NewMultipleFrameOutput(outputters ...FrameOutputter) *MultipleFrameOutput {
	return &MultipleFrameOutput{Outputters: outputters}
}
