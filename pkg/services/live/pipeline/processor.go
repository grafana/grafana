package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Processor can modify data.Frame in a custom way before it will be outputted.
type Processor interface {
	Process(ctx context.Context, vars ProcessorVars, frame *data.Frame) (*data.Frame, error)
}
