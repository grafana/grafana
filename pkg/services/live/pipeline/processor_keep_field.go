package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type KeepFieldsProcessorConfig struct {
	FieldNames []string `json:"fieldNames"`
}

// KeepFieldsProcessor can keep specified fields in a data.Frame dropping all other fields.
type KeepFieldsProcessor struct {
	config KeepFieldsProcessorConfig
}

func NewKeepFieldsProcessor(config KeepFieldsProcessorConfig) *KeepFieldsProcessor {
	return &KeepFieldsProcessor{config: config}
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

const ProcessorTypeKeepFields = "keepFields"

func (p *KeepFieldsProcessor) Type() string {
	return ProcessorTypeKeepFields
}

func (p *KeepFieldsProcessor) Process(_ context.Context, _ ProcessorVars, frame *data.Frame) (*data.Frame, error) {
	var fieldsToKeep []*data.Field
	for _, field := range frame.Fields {
		if stringInSlice(field.Name, p.config.FieldNames) {
			fieldsToKeep = append(fieldsToKeep, field)
		}
	}
	f := data.NewFrame(frame.Name, fieldsToKeep...)
	return f, nil
}
