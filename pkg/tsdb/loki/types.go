package loki

import "time"

type LokiQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefId        string
}
