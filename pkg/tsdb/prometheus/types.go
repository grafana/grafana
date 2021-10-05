package prometheus

import (
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

type DatasourceInfo struct {
	ID             int64
	HTTPClientOpts sdkhttpclient.Options
	URL            string
	HTTPMethod     string
	TimeInterval   string
}

type PrometheusQuery struct {
	Expr         string
	Step         time.Duration
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefId        string
	InstantQuery bool
	RangeQuery   bool
	UtcOffsetSec int64
}

type QueryModel struct {
	Expr           string `json:"expr"`
	LegendFormat   string `json:"legendFormat"`
	Interval       string `json:"interval"`
	IntervalMS     int64  `json:"intervalMS"`
	StepMode       string `json:"stepMode"`
	RangeQuery     bool   `json:"range"`
	InstantQuery   bool   `json:"instant"`
	IntervalFactor int64  `json:"intervalFactor"`
	UtcOffsetSec   int64  `json:"utcOffsetSec"`
}

type PrometheusQueryType string

const (
	Range   PrometheusQueryType = "range"
	Instant PrometheusQueryType = "instant"
)
