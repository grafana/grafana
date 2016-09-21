package prometheus

import "time"

type PrometheusQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
}
