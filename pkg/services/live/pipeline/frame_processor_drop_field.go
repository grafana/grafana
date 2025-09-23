package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// DropFieldsFrameProcessor can drop specified fields from a data.Frame.
type DropFieldsFrameProcessor struct {
	config DropFieldsFrameProcessorConfig
}

func removeIndex(s []*data.Field, index int) []*data.Field {
	return append(s[:index], s[index+1:]...)
}

func NewDropFieldsFrameProcessor(config DropFieldsFrameProcessorConfig) *DropFieldsFrameProcessor {
	return &DropFieldsFrameProcessor{config: config}
}

const FrameProcessorTypeDropFields = "dropFields"

func (p *DropFieldsFrameProcessor) Type() string {
	return FrameProcessorTypeDropFields
}

func (p *DropFieldsFrameProcessor) ProcessFrame(_ context.Context, _ Vars, frame *data.Frame) (*data.Frame, error) {
	for _, f := range p.config.FieldNames {
	inner:
		for i, field := range frame.Fields {
			if f == field.Name {
				frame.Fields = removeIndex(frame.Fields, i)
				continue inner
			}
		}
	}
	return frame, nil
}
