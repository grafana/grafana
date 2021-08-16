package telemetry

import "github.com/grafana/grafana-plugin-sdk-go/data"

// Converter can convert input to Grafana Data Frames.
type Converter interface {
	Convert(data []byte, channelFormat string) ([]*data.Frame, error)
}
