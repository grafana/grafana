package alerting

import "github.com/grafana/grafana/pkg/components/null"

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

type Level struct {
	Operator string
	Value    float64
}
