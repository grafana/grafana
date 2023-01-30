package loki

import (
	"time"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

type QueryType = dataquery.LokiQueryType
type SupportingQueryType = dataquery.SupportingQueryType

const (
	QueryTypeRange   = dataquery.LokiQueryTypeRange
	QueryTypeInstant = dataquery.LokiQueryTypeInstant
)

const (
	SupportingQueryLogsVolume                     = dataquery.SupportingQueryTypeLogsVolume
	SupportingQueryLogsSample                     = dataquery.SupportingQueryTypeLogsSample
	SupportingQueryDataSample                     = dataquery.SupportingQueryTypeDataSample
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
