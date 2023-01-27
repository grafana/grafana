package loki

import "time"

type QueryType string
type SupportingQueryType string

const (
	QueryTypeRange   QueryType = "range"
	QueryTypeInstant QueryType = "instant"
)

const (
	SupportingQueryLogsVolume SupportingQueryType = "logsVolume"
	SupportingQueryLogsSample SupportingQueryType = "logsSample"
	SupportingQueryDataSample SupportingQueryType = "dataSample"
	SupportingQueryNone       SupportingQueryType = "none"
)

type Direction string

const (
	DirectionBackward Direction = "backward"
	DirectionForward  Direction = "forward"
)

type lokiQuery struct {
	Expr                string
	QueryType           QueryType
	Direction           Direction
	Step                time.Duration
	MaxLines            int
	LegendFormat        string
	Start               time.Time
	End                 time.Time
	RefID               string
	SupportingQueryType SupportingQueryType
}
