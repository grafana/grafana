package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MatchOutput struct {
}

func NewMatchOutput(paramName string, paramMap map[string]Outputter) *MatchOutput {
	return &MatchOutput{}
}

func (l *MatchOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) error {
	return nil
}
