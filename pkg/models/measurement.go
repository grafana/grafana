package models

import "github.com/grafana/grafana-plugin-sdk-go/data"

// NOTE:
// this likely shoud go in the Plugin SDK since it will be useful from plugins

// Measurement is a single measurement value
type Measurement struct {
	// the measurement name
	Name string `json:"name,omitempty"`

	// units are usually ms, but depend on the channel
	Time int64 `json:"time,omitempty"`

	// typically number or string
	Values map[string]interface{} `json:"values,omitempty"`

	// optional list of field configs
	Config map[string]data.FieldConfig `json:"config,omitempty"`

	// labels are applied to all values
	Labels map[string]string `json:"labels,omitempty"`
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
	// default action is append
	Action MeasurementAction `json:"action,omitempty"`

	// batch of measurments
	Measures []Measurement `json:"measures,omitempty"`

	// The suggested size of the client buffer
	Capacity int64 `json:"capacity,omitempty"`
}
