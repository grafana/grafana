package loki

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type QueryType string

const (
	QueryTypeRange   QueryType = "range"
	QueryTypeInstant QueryType = "instant"
)

type lokiQuery struct {
	Expr         string
	QueryType    QueryType
	Step         time.Duration
	MaxLines     int
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefID        string
	VolumeQuery  bool
}

type lokiResponse struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream data.Labels `json:"stream"`
	Values [][2]string `json:"values"`
}
