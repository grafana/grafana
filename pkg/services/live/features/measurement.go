package features

import (
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// Measurement is a single measurement value
type Measurement struct {
	Name      string                 `json:"name,omitempty"`
	Timestamp int64                  `json:"time,omitempty"`   // units are usually ms, but depend on the channel
	Values    map[string]interface{} `json:"values,omitempty"` // typically number or string
	Labels    map[string]string      `json:"labels,omitempty"` // labels are applied to all values
}

// MeasurementBatch is a collection of measurments all sent at once
type MeasurementBatch struct {
	measures []Measurement
}

// MeasurementRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This makes no assumptions about the shape of the data and will broadcast it to anyone listening
type MeasurementRunner struct{}

// GetHandlerForPath called on init
func (g *MeasurementRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return g, nil // for now all channels share config
}

// GetChannelOptions called fast and often
func (g *MeasurementRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *MeasurementRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// anyone can subscribe
	return nil
}

// OnPublish called when an event is received from the websocket
func (g *MeasurementRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// currenly generic... but should be more strict
	return e.Data, nil
}
