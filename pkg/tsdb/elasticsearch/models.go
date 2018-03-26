package elasticsearch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type QueryHeader struct {
	SearchType                 string      `json:"search_type"`
	IgnoreUnavailable          bool        `json:"ignore_unavailable"`
	Index                      interface{} `json:"index"`
	MaxConcurrentShardRequests int         `json:"max_concurrent_shard_requests,omitempty"`
}

func (q *QueryHeader) String() string {
	r, _ := json.Marshal(q)
	return string(r)
}

type Request struct {
	Query map[string]interface{} `json:"query"`
	Aggs  Aggs                   `json:"aggs"`
	Size  int                    `json:"size"`
}

type Aggs map[string]interface{}

type HistogramAgg struct {
	Interval    string `json:"interval,omitempty"`
	Field       string `json:"field"`
	MinDocCount int    `json:"min_doc_count"`
	Missing     string `json:"missing,omitempty"`
}

type DateHistogramAgg struct {
	HistogramAgg
	ExtendedBounds ExtendedBounds `json:"extended_bounds"`
	Format         string         `json:"format"`
}

type FiltersAgg struct {
	Filter map[string]interface{} `json:"filter"`
}

type TermsAggSetting struct {
	Field   string                 `json:"field"`
	Size    int                    `json:"size"`
	Order   map[string]interface{} `json:"order"`
	Missing string                 `json:"missing,omitempty"`
}

type TermsAgg struct {
	Terms TermsAggSetting `json:"terms"`
	Aggs  Aggs            `json:"aggs"`
}

type ExtendedBounds struct {
	Min string `json:"min"`
	Max string `json:"max"`
}

type RangeFilter struct {
	Range map[string]RangeFilterSetting `json:"range"`
}
type RangeFilterSetting struct {
	Gte    string `json:"gte"`
	Lte    string `json:"lte"`
	Format string `json:"format"`
}

func newRangeFilter(field string, rangeFilterSetting RangeFilterSetting) *RangeFilter {
	return &RangeFilter{
		map[string]RangeFilterSetting{field: rangeFilterSetting}}
}

type QueryStringFilter struct {
	QueryString QueryStringFilterSetting `json:"query_string"`
}
type QueryStringFilterSetting struct {
	AnalyzeWildcard bool   `json:"analyze_wildcard"`
	Query           string `json:"query"`
}

func newQueryStringFilter(analyzeWildcard bool, query string) *QueryStringFilter {
	return &QueryStringFilter{QueryStringFilterSetting{AnalyzeWildcard: analyzeWildcard, Query: query}}
}

type BoolQuery struct {
	Filter []interface{} `json:"filter"`
}

type Metric map[string]interface{}

type Responses struct {
	Responses []Response `json:"responses"`
}

type Response struct {
	Status       int                    `json:"status"`
	Err          map[string]interface{} `json:"error"`
	Aggregations map[string]interface{} `json:"aggregations"`
}

func (r *Response) getErrMsg() string {
	var msg bytes.Buffer
	errJson := simplejson.NewFromAny(r.Err)
	errType, err := errJson.Get("type").String()
	if err == nil {
		msg.WriteString(fmt.Sprintf("type:%s", errType))
	}

	reason, err := errJson.Get("type").String()
	if err == nil {
		msg.WriteString(fmt.Sprintf("reason:%s", reason))
	}
	return msg.String()
}
