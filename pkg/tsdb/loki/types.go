package loki

import (
	"time"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

type QueryType = dataquery.LokiQueryType

const (
	QueryTypeRange   = dataquery.LokiQueryTypeRange
	QueryTypeInstant = dataquery.LokiQueryTypeInstant
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
