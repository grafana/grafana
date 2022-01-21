package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MultipleFrameProcessor can combine several FrameProcessor and
// execute them sequentially.
type MultipleFrameProcessor struct {
	Processors []FrameProcessor
}

const FrameProcessorTypeMultiple = "multiple"

func (p *MultipleFrameProcessor) Type() string {
	return FrameProcessorTypeMultiple
}

func (p *MultipleFrameProcessor) ProcessFrame(ctx context.Context, vars Vars, frame *data.Frame) (*data.Frame, error) {
	for _, p := range p.Processors {
		var err error
		frame, err = p.ProcessFrame(ctx, vars, frame)
		if err != nil {
			logger.Error("Error processing frame", "error", err)
			return nil, err
		}
	}
	return frame, nil
}

func NewMultipleFrameProcessor(processors ...FrameProcessor) *MultipleFrameProcessor {
	return &MultipleFrameProcessor{Processors: processors}
}
