package cloudwatch

import (
	"fmt"
)

type queryError struct {
	err   error
	RefID string
}

func (e *queryError) Error() string {
	return fmt.Sprintf("error parsing query %q, %s", e.RefID, e.err)
}

type cloudWatchLink struct {
	View    string        `json:"view"`
	Stacked bool          `json:"stacked"`
	Title   string        `json:"title"`
	Start   string        `json:"start"`
	End     string        `json:"end"`
	Region  string        `json:"region"`
	Metrics []interface{} `json:"metrics"`
}

type metricExpression struct {
	Expression string `json:"expression"`
}

type metricStatMeta struct {
	Stat   string `json:"stat"`
	Period int    `json:"period"`
}

type metricQueryType uint32

const (
	MetricQueryTypeSearch metricQueryType = iota
	MetricQueryTypeQuery
)

type metricEditorMode uint32

const (
	MetricEditorModeBuilder metricEditorMode = iota
	MetricEditorModeRaw
)

type gmdApiMode uint32

const (
	GMDApiModeMetricStat gmdApiMode = iota
	GMDApiModeInferredSearchExpression
	GMDApiModeMathExpression
	GMDApiModeSQLExpression
)

type fillMissing struct {
	mode  fillMode
	value float64
}

type fillMode int

const (
	null     fillMode = iota // fills with null, the default behavior
	previous                 // fills with the last seen value unless that does not exist, in which case it fills with null
	value                    // fills with a specific value
	optOut                   // does not fill
)
