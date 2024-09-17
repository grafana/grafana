package telemetry

import "github.com/grafana/grafana-plugin-sdk-go/data"

// Converter can convert input to Grafana Data Frames.
type Converter interface {
	Convert(data []byte) ([]FrameWrapper, error)
}

// FrameWrapper is a wrapper over data.Frame.
type FrameWrapper interface {
	// Key returns a key which describes Frame metrics.
	Key() string
	// Frame allows getting data.Frame.
	Frame() *data.Frame
}
