package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MultipleOutputter struct {
	Outputters []Outputter
}

func (m MultipleOutputter) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	for _, out := range m.Outputters {
		err := out.Output(ctx, vars, frame)
		if err != nil {
			logger.Error("Error outputting frame", "error", err)
			return err
		}
	}
	return nil
}

func NewMultipleOutputter(outputters ...Outputter) *MultipleOutputter {
	return &MultipleOutputter{Outputters: outputters}
}
