package prometheus

import (
	"time"

	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type DatasourceInfo struct {
	ID           int64
	URL          string
	TimeInterval string

	getClient clientGetter
}

type clientGetter func(map[string]string) (apiv1.API, error)

type PrometheusQuery struct {
	Expr          string
	Step          time.Duration
	LegendFormat  string
	Start         time.Time
	End           time.Time
	RefId         string
	InstantQuery  bool
	RangeQuery    bool
	ExemplarQuery bool
	UtcOffsetSec  int64
}

type ExemplarEvent struct {
	Time   time.Time
	Value  float64
	Labels map[string]string
}

type QueryModel struct {
	Expr           string `json:"expr"`
	LegendFormat   string `json:"legendFormat"`
	Interval       string `json:"interval"`
	IntervalMS     int64  `json:"intervalMS"`
	StepMode       string `json:"stepMode"`
	RangeQuery     bool   `json:"range"`
	InstantQuery   bool   `json:"instant"`
	ExemplarQuery  bool   `json:"exemplar"`
	IntervalFactor int64  `json:"intervalFactor"`
	UtcOffsetSec   int64  `json:"utcOffsetSec"`
}
