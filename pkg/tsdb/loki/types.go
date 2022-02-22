package loki

import "time"

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
