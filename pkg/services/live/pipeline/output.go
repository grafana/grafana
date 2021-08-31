package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Outputter outputs data.Frame to a custom destination. Or simply
// do nothing if some conditions not met.
type Outputter interface {
	Output(ctx context.Context, vars OutputVars, frame *data.Frame) ([]*ChannelFrame, error)
}
