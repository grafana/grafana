package models

import "github.com/grafana/grafana-plugin-sdk-go/data"

// NOTE:
// this likely should go in the Plugin SDK since it will be useful from plugins

// Measurement is a single measurement value.
type Measurement struct {
	// Name of the measurement.
	Name string `json:"name,omitempty"`

	// Time is the measurement time. Units are usually ms, but depends on the channel
	Time int64 `json:"time,omitempty"`

	// Values is the measurement's values. The value type is typically number or string.
	Values map[string]interface{} `json:"values,omitempty"`

	// Config is an optional list of field configs.
	Config map[string]data.FieldConfig `json:"config,omitempty"`

	// Labels are applied to all values.
	Labels map[string]string `json:"labels,omitempty"`
}

// MeasurementAction defines what should happen when you send a list of measurements.
type MeasurementAction string

const (
	// MeasurementActionAppend means new values should be added to a client buffer.  This is the default action
	MeasurementActionAppend MeasurementAction = "append"

	// MeasurementActionReplace means new values should replace any existing values.
	MeasurementActionReplace MeasurementAction = "replace"

	// MeasurementActionClear means all existing values should be remoed before adding.
	MeasurementActionClear MeasurementAction = "clear"
)

// MeasurementBatch is a collection of measurements all sent at once.
type MeasurementBatch struct {
	// Action is the action in question, the default is append.
	Action MeasurementAction `json:"action,omitempty"`

	// Measurements is the array of measurements.
	Measurements []Measurement `json:"measurements,omitempty"`

	// Capacity is the suggested size of the client buffer
	Capacity int64 `json:"capacity,omitempty"`
}
