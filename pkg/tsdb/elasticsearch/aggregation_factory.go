package elasticsearch

import (
	"regexp"

	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// addDateHistogramAgg adds a date histogram aggregation to the aggregation builder
func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo int64, timeField string) es.AggBuilder {
	// If no field is specified, use the time field
	field := bucketAgg.Field
	if field == "" {
		field = timeField
	}
	aggBuilder.DateHistogram(bucketAgg.ID, field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		var interval = bucketAgg.Settings.Get("interval").MustString("auto")
		if isCalendarInterval(interval) {
			a.CalendarInterval = interval
		} else {
			if interval == "auto" {
				// note this is not really a valid grafana-variable-handling,
				// because normally this would not match `$__interval_ms`,
				// but because how we apply these in the go-code, this will work
				// correctly, and becomes something like `500ms`.
				// a nicer way would be to use `${__interval_ms}ms`, but
				// that format is not recognized where we apply these variables
				// in the elasticsearch datasource
				a.FixedInterval = "$__interval_msms"
			} else {
				a.FixedInterval = interval
			}
		}
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

		if offset, err := bucketAgg.Settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if timezone, err := bucketAgg.Settings.Get("timeZone").String(); err == nil {
			if timezone != "utc" {
				a.TimeZone = timezone
			}
		}

		aggBuilder = b
	})

	return aggBuilder
}

// addHistogramAgg adds a histogram aggregation to the aggregation builder
func addHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Histogram(bucketAgg.ID, bucketAgg.Field, func(a *es.HistogramAgg, b es.AggBuilder) {
		a.Interval = stringToFloatWithDefaultValue(bucketAgg.Settings.Get("interval").MustString(), 1000)
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.Settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

// addTermsAgg adds a terms aggregation to the aggregation builder
func addTermsAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, metrics []*MetricAgg) es.AggBuilder {
	aggBuilder.Terms(bucketAgg.ID, bucketAgg.Field, func(a *es.TermsAggregation, b es.AggBuilder) {
		if size, err := bucketAgg.Settings.Get("size").Int(); err == nil {
			a.Size = size
		} else {
			a.Size = stringToIntWithDefaultValue(bucketAgg.Settings.Get("size").MustString(), defaultSize)
		}

		if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
			a.MinDocCount = &minDocCount
		}
		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if orderBy, err := bucketAgg.Settings.Get("orderBy").String(); err == nil {
			/*
			   The format for extended stats and percentiles is {metricId}[bucket_path]
			   for everything else it's just {metricId}, _count, _term, or _key
			*/
			metricIdRegex := regexp.MustCompile(`^(\d+)`)
			metricId := metricIdRegex.FindString(orderBy)

			if len(metricId) > 0 {
				for _, m := range metrics {
					if m.ID == metricId {
						if m.Type == "count" {
							a.Order["_count"] = bucketAgg.Settings.Get("order").MustString("desc")
						} else {
							a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
							b.Metric(m.ID, m.Type, m.Field, nil)
						}
						break
					}
				}
			} else {
				a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
			}
		}

		aggBuilder = b
	})

	return aggBuilder
}

// addNestedAgg adds a nested aggregation to the aggregation builder
func addNestedAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Nested(bucketAgg.ID, bucketAgg.Field, func(a *es.NestedAggregation, b es.AggBuilder) {
		aggBuilder = b
	})

	return aggBuilder
}

// addFiltersAgg adds a filters aggregation to the aggregation builder
func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	filters := make(map[string]any)
	for _, filter := range bucketAgg.Settings.Get("filters").MustArray() {
		json := simplejson.NewFromAny(filter)
		query := json.Get("query").MustString()
		label := json.Get("label").MustString()
		if label == "" {
			label = query
		}
		filters[label] = &es.QueryStringFilter{Query: query, AnalyzeWildcard: true}
	}

	if len(filters) > 0 {
		aggBuilder.Filters(bucketAgg.ID, func(a *es.FiltersAggregation, b es.AggBuilder) {
			a.Filters = filters
			aggBuilder = b
		})
	}

	return aggBuilder
}

// addGeoHashGridAgg adds a geohash grid aggregation to the aggregation builder
func addGeoHashGridAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.ID, bucketAgg.Field, func(a *es.GeoHashGridAggregation, b es.AggBuilder) {
		a.Precision = stringToIntWithDefaultValue(bucketAgg.Settings.Get("precision").MustString(), es.DefaultGeoHashPrecision)
		aggBuilder = b
	})

	return aggBuilder
}

// isCalendarInterval checks if the interval is a calendar interval
func isCalendarInterval(interval string) bool {
	calendarIntervals := []string{"1w", "1M", "1q", "1y"}
	for _, ci := range calendarIntervals {
		if interval == ci {
			return true
		}
	}
	return false
}
