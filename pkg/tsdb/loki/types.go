package loki

import "time"

type lokiQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefID        string
	StreamKey    string // unique channel based on query (calcuated in the frontend)
}
