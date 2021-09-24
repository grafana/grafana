package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MultipleProcessor can combine several Processor and
// execute them sequentially.
type MultipleProcessor struct {
	Processors []Processor
}

const ProcessorTypeMultiple = "multiple"

func (p *MultipleProcessor) Type() string {
	return ProcessorTypeMultiple
}

func (p *MultipleProcessor) Process(ctx context.Context, vars ProcessorVars, frame *data.Frame) (*data.Frame, error) {
	for _, p := range p.Processors {
		var err error
		frame, err = p.Process(ctx, vars, frame)
		if err != nil {
			logger.Error("Error processing frame", "error", err)
			return nil, err
		}
	}
	return frame, nil
}

func NewMultipleProcessor(processors ...Processor) *MultipleProcessor {
	return &MultipleProcessor{Processors: processors}
}
