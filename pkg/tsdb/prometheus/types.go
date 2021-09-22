package prometheus

import "time"

type PrometheusQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefId        string
	QueryType    PrometheusQueryType
}

type PrometheusQueryType string

const (
	Range PrometheusQueryType = "range"
	//This is currently not used, but we will use it in next iteration
	Instant PrometheusQueryType = "instant"
)
