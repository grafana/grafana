package druid

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"time"
)

type DruidQueryParser struct{}

const (
	DRUID_DATA_SOURCE = "druidDS"
	DATA_SOURCE       = "dataSource"

	CUSTOM_GRANULARITY = "customGranularity"
	GRANULARITY        = "granularity"

	AGGREGATORS  = "aggregators"
	AGGREGATIONS = "aggregations"

	POST_AGGREGATORS  = "postAggregators"
	POST_AGGREGATIONS = "postAggregations"

	DRUID_METRIC = "druidMetric"
	METRIC       = "metric"

	SELECT_THRESHOLD = "selectThreshold"
	THRESHOLD        = "threshold"

	INTERVALS = "intervals"
)

func (e *DruidQueryParser) ParseQuery(data *simplejson.Json, queryContext *tsdb.QueryContext) {

	dataSource := data.Get(DRUID_DATA_SOURCE).MustString()
	if dataSource != "" {
		data.Del(DRUID_DATA_SOURCE)
		data.Set(DATA_SOURCE, dataSource)
	}

	granularity := data.Get(CUSTOM_GRANULARITY).MustString()
	if granularity != "" {
		data.Del(CUSTOM_GRANULARITY)
		data.Set(GRANULARITY, granularity)
	}

	aggregations := data.Get(AGGREGATORS).MustArray()
	if aggregations != nil {
		data.Del(AGGREGATORS)
		data.Set(AGGREGATIONS, aggregations)
	}

	postAggregations := data.Get(POST_AGGREGATORS).MustArray()
	if postAggregations != nil {
		data.Del(POST_AGGREGATORS)
		data.Set(POST_AGGREGATIONS, postAggregations)
	}

	metric := data.Get(DRUID_METRIC).MustString()
	if metric != "" {
		data.Del(DRUID_METRIC)
		data.Set(METRIC, metric)
	}

	threshold := data.Get(SELECT_THRESHOLD).MustInt()
	if threshold != 0 {
		data.Del(SELECT_THRESHOLD)
		data.Set(THRESHOLD, threshold)
	}

	from := queryContext.TimeRange.GetFromAsMsEpoch()
	to := queryContext.TimeRange.GetToAsMsEpoch()
	fromString := time.Unix(0, from*int64(time.Millisecond)).Format(time.RFC3339)
	toString := time.Unix(0, to*int64(time.Millisecond)).Format(time.RFC3339)

	timeSeg := []string{fromString + "/" + toString}
	data.Set(INTERVALS, timeSeg)
}
