package alerting

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
)

type Job struct {
	Offset     int64
	OffsetWait bool
	Delay      bool
	Running    bool
	Rule       *Rule
}

type ResultLogEntry struct {
	Message string
	Data    interface{}
}

type EvalMatch struct {
	Value  null.Float        `json:"value"`
	Metric string            `json:"metric"`
	Tags   map[string]string `json:"tags"`
}


// TimeSeries return a string represent a time series.
// It concatenates metric name and tags, EX: cpu{region=us, host=01}.
func (e * EvalMatch) TimeSeries() string {
	var kv string
	for k, v := range e.Tags {
		kv = fmt.Sprintf("%s, %s=%s", kv, k, v)
	}

	return fmt.Sprintf("%s{%s}", e.Metric, kv)
}

type Level struct {
	Operator string
	Value    float64
}
