package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Processor interface {
	Process(ctx context.Context, vars ProcessorVars, frame *data.Frame) (*data.Frame, error)
}
