package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Outputter interface {
	Output(ctx context.Context, vars OutputVars, frame *data.Frame) error
}
