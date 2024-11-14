package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// KeepFieldsFrameProcessor can keep specified fields in a data.Frame dropping all other fields.
type KeepFieldsFrameProcessor struct {
	config KeepFieldsFrameProcessorConfig
}

func NewKeepFieldsFrameProcessor(config KeepFieldsFrameProcessorConfig) *KeepFieldsFrameProcessor {
	return &KeepFieldsFrameProcessor{config: config}
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

const FrameProcessorTypeKeepFields = "keepFields"

func (p *KeepFieldsFrameProcessor) Type() string {
	return FrameProcessorTypeKeepFields
}

func (p *KeepFieldsFrameProcessor) ProcessFrame(_ context.Context, _ Vars, frame *data.Frame) (*data.Frame, error) {
	var fieldsToKeep []*data.Field
	for _, field := range frame.Fields {
		if stringInSlice(field.Name, p.config.FieldNames) {
			fieldsToKeep = append(fieldsToKeep, field)
		}
	}
	f := data.NewFrame(frame.Name, fieldsToKeep...)
	return f, nil
}
