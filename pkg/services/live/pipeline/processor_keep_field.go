package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type KeepFieldsProcessor struct {
	keep []string
}

func NewKeepFieldsProcessor(keep ...string) *KeepFieldsProcessor {
	return &KeepFieldsProcessor{keep: keep}
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func (d KeepFieldsProcessor) Process(_ context.Context, _ ProcessorVars, frame *data.Frame) (*data.Frame, error) {
	var fieldsToKeep []*data.Field
	for _, field := range frame.Fields {
		if stringInSlice(field.Name, d.keep) {
			fieldsToKeep = append(fieldsToKeep, field)
		}
	}
	f := data.NewFrame(frame.Name, fieldsToKeep...)
	return f, nil
}
