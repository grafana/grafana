package loki

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type lokiQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefID        string
}

type lokiResponse struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream data.Labels `json:"stream"`
	Values [][2]string `json:"values"`
}
