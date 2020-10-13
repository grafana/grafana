package models

import "github.com/grafana/grafana-plugin-sdk-go/data"

// NOTE:  this likely shoud go in the Plugin SDK since it will be useful from plugins

// Measurement is a single measurement value
type Measurement struct {
	Name   string                      `json:"name,omitempty"`
	Time   int64                       `json:"time,omitempty"`   // units are usually ms, but depend on the channel
	Values map[string]interface{}      `json:"values,omitempty"` // typically number or string
	Config map[string]data.FieldConfig `json:"config,omitempty"` // optional list of field configs
	Labels map[string]string           `json:"labels,omitempty"` // labels are applied to all values
}

// MeasurementAction defines what should happen when you send a list of measurements
type MeasurementAction string

const (
	// MeasurementActionAppend means new values should be added to a client buffer.  This is the default action
	MeasurementActionAppend MeasurementAction = "append"

	// MeasurementActionReplace means new values should replace any existing values
	MeasurementActionReplace MeasurementAction = "replace"

	// MeasurementActionClear means all existing values should be remoed before adding
	MeasurementActionClear MeasurementAction = "clear"
)

// MeasurementBatch is a collection of measurments all sent at once
type MeasurementBatch struct {
	Action   MeasurementAction `json:"action,omitempty"`   // default action is append
	Measures []Measurement     `json:"measures,omitempty"` // batch of measurments
	Capacity int64             `json:"capacity,omitempty"` // The suggested size of the client buffer
}
