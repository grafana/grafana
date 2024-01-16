package loki

import (
	"time"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

type QueryType = dataquery.LokiQueryType
type SupportingQueryType = dataquery.SupportingQueryType
type Direction = dataquery.LokiQueryDirection

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

const (
	DirectionBackward = dataquery.LokiQueryDirectionBackward
	DirectionForward  = dataquery.LokiQueryDirectionForward
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
