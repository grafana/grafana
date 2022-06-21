package loki

import "time"

type QueryType string

const (
	QueryTypeRange   QueryType = "range"
	QueryTypeInstant QueryType = "instant"
)

type Direction string

const (
	DirectionBackward Direction = "backward"
	DirectionForward  Direction = "forward"
)

type lokiQuery struct {
	Expr         string
	QueryType    QueryType
	Direction    Direction
	Step         time.Duration
	MaxLines     int
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefID        string
	VolumeQuery  bool
}
