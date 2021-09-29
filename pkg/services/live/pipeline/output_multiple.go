package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MultipleOutput can combine several Outputter and
// execute them sequentially.
type MultipleOutput struct {
	Outputters []Outputter
}

const OutputTypeMultiple = "multiple"

func (out *MultipleOutput) Type() string {
	return OutputTypeMultiple
}

func (out MultipleOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
	var frames []*ChannelFrame
	for _, out := range out.Outputters {
		f, err := out.Output(ctx, vars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return nil, err
		}
		frames = append(frames, f...)
	}
	return frames, nil
}

func NewMultipleOutput(outputters ...Outputter) *MultipleOutput {
	return &MultipleOutput{Outputters: outputters}
}
