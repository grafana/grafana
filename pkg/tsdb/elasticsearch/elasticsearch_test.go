package elasticsearch

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"time"
)

var avgWithMovingAvg = Query{
	TimeField: "timestamp",
	RawQuery:  "(test:query) AND (name:sample)",
	Interval:  time.Millisecond,
	BucketAggs: []*BucketAgg{{
		Field: "timestamp",
		ID:    "2",
		Type:  "date_histogram",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"interval":      "auto",
			"min_doc_count": 0,
			"trimEdges":     0,
		}),
	}},
	Metrics: []*Metric{{
		Field: "value",
		ID:    "1",
		Type:  "avg",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"script": map[string]string{
				"inline": "_value * 2",
			},
		}),
	}, {
		Field:             "1",
		ID:                "3",
		Type:              "moving_avg",
		PipelineAggregate: "1",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"minimize": false,
			"model":    "simple",
			"window":   5,
		}),
	}},
}

var wildcardsAndQuotes = Query{
	TimeField: "timestamp",
	RawQuery:  "scope:$location.leagueconnect.api AND name:*CreateRegistration AND name:\"*.201-responses.rate\"",
	Interval:  time.Millisecond,
	BucketAggs: []*BucketAgg{{
		Field:    "timestamp",
		ID:       "2",
		Type:     "date_histogram",
		Settings: simplejson.NewFromAny(map[string]interface{}{}),
	}},
	Metrics: []*Metric{{
		Field:    "value",
		ID:       "1",
		Type:     "sum",
		Settings: simplejson.NewFromAny(map[string]interface{}{}),
	}},
}
var termAggs = Query{
	TimeField: "timestamp",
	RawQuery:  "(scope:*.hmp.metricsd) AND (name_raw:builtin.general.*_instance_count)",
	Interval:  time.Millisecond,
	BucketAggs: []*BucketAgg{{
		Field: "name_raw",
		ID:    "4",
		Type:  "terms",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"order":   "desc",
			"orderBy": "_term",
			"size":    "10",
		}),
	}, {
		Field: "timestamp",
		ID:    "2",
		Type:  "date_histogram",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"interval":      "auto",
			"min_doc_count": 0,
			"trimEdges":     0,
		}),
	}},
	Metrics: []*Metric{{
		Field:    "value",
		ID:       "1",
		Type:     "sum",
		Settings: simplejson.NewFromAny(map[string]interface{}{}),
	}},
}

var filtersAggs = Query{
	TimeField: "time",
	RawQuery:  "*",
	Interval:  time.Millisecond,
	BucketAggs: []*BucketAgg{{
		ID:   "3",
		Type: "filters",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"filters": []interface{}{
				map[string]interface{}{"label": "hello", "query": "host:\"67.65.185.232\""},
			},
		}),
	}, {
		Field: "timestamp",
		ID:    "2",
		Type:  "date_histogram",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"interval":      "auto",
			"min_doc_count": 0,
			"trimEdges":     0,
		}),
	}},
	Metrics: []*Metric{{
		Field:             "bytesSent",
		ID:                "1",
		Type:              "count",
		PipelineAggregate: "select metric",
		Settings:          simplejson.NewFromAny(map[string]interface{}{}),
	}},
}
