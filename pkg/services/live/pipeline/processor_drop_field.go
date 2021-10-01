package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DropFieldsProcessorConfig struct {
	FieldNames []string `json:"fieldNames"`
}

// DropFieldsProcessor can drop specified fields from a data.Frame.
type DropFieldsProcessor struct {
	config DropFieldsProcessorConfig
}

func removeIndex(s []*data.Field, index int) []*data.Field {
	return append(s[:index], s[index+1:]...)
}

func NewDropFieldsProcessor(config DropFieldsProcessorConfig) *DropFieldsProcessor {
	return &DropFieldsProcessor{config: config}
}

const ProcessorTypeDropFields = "dropFields"

func (p *DropFieldsProcessor) Type() string {
	return ProcessorTypeDropFields
}

func (p *DropFieldsProcessor) Process(_ context.Context, _ ProcessorVars, frame *data.Frame) (*data.Frame, error) {
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
