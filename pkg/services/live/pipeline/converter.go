package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ChannelFrame is a wrapper over data.Frame with additional channel information.
// Channel is used for rule routing, if the channel is empty then frame processing
// will try to take current rule Processor and Outputter. If channel is not empty
// then frame processing will be redirected to a corresponding channel rule.
// TODO: avoid recursion.
type ChannelFrame struct {
	Channel string
	Frame   *data.Frame
}

// Converter converts raw bytes to slice of ChannelFrame. Each element
// of resulting slice will be then individually processed and outputted
// according configured channel rules.
type Converter interface {
	Convert(ctx context.Context, vars Vars, body []byte) ([]*ChannelFrame, error)
}
