package models

// NOTE:  this likely shoud go in the Plugin SDK since it will be required form there

// Measurement is a single measurement value
type Measurement struct {
	Name   string                 `json:"name,omitempty"`
	Time   int64                  `json:"time,omitempty"`   // units are usually ms, but depend on the channel
	Values map[string]interface{} `json:"values,omitempty"` // typically number or string
	Labels map[string]string      `json:"labels,omitempty"` // labels are applied to all values
}

// MeasurementMessage is a collection of measurments all sent at once
type MeasurementMessage struct {
	Measures []Measurement `json:"measures,omitempty"` // batch of measurments
}
