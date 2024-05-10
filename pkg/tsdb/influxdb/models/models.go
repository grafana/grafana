package models

import "time"

type Query struct {
	Measurement  string
	Policy       string
	Tags         []*Tag
	GroupBy      []*QueryPart
	Selects      []*Select
	RawQuery     string
	UseRawQuery  bool
	Alias        string
	Interval     time.Duration
	Tz           string
	Limit        string
	Slimit       string
	OrderByTime  string
	RefID        string
	ResultFormat string
}

type Tag struct {
	Key       string
	Operator  string
	Value     string
	Condition string
}

type Select []QueryPart

type Response struct {
	Results []Result
	Error   string

	// This field is not part of official InfluxQL API response.
	// Some users are using proxy in between InfluxDB and Grafana.
	// They add additional data through this field.
	// We make sure this data will be passed through Grafana frontend
	// so they can check it in Query Inspector
	CustomResponse any `json:"influx_response"`
}

type Result struct {
	Series   []Row
	Messages []*Message
	Error    string
}

type Message struct {
	Level string `json:"level,omitempty"`
	Text  string `json:"text,omitempty"`
}

type Row struct {
	Name    string            `json:"name,omitempty"`
	Tags    map[string]string `json:"tags,omitempty"`
	Columns []string          `json:"columns,omitempty"`
	Values  [][]any           `json:"values,omitempty"`
}
