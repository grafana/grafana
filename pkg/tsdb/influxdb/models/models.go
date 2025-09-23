package models

import (
	"time"

	"github.com/influxdata/influxql"
)

type Query struct {
	Measurement  string
	Policy       string
	Tags         []*Tag
	AdhocFilters []*Tag
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
	Statement    influxql.Statement
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
	Code    string
	Message string
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
