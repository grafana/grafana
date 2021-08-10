package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DropFieldsProcessor struct {
	drop []string
}

func removeIndex(s []*data.Field, index int) []*data.Field {
	return append(s[:index], s[index+1:]...)
}

func NewDropFieldsProcessor(drop ...string) *DropFieldsProcessor {
	return &DropFieldsProcessor{drop: drop}
}

func (d DropFieldsProcessor) Process(_ context.Context, _ ProcessorVars, frame *data.Frame) (*data.Frame, error) {
	for _, f := range d.drop {
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
