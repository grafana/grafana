package prometheus

import "time"

type PrometheusQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefId        string
}
