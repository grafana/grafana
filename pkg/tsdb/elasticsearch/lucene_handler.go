package elasticsearch

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type luceneHandler struct {
	client             es.Client
	tsdbQuery          *tsdb.TsdbQuery
	intervalCalculator tsdb.IntervalCalculator
	ms                 *es.MultiSearchRequestBuilder
	queries            []*Query
}

var newLuceneHandler = func(client es.Client, tsdbQuery *tsdb.TsdbQuery, intervalCalculator tsdb.IntervalCalculator) *luceneHandler {
	return &luceneHandler{
		client:             client,
		tsdbQuery:          tsdbQuery,
		intervalCalculator: intervalCalculator,
		ms:                 client.MultiSearch(),
		queries:            make([]*Query, 0),
	}
}

func (h *luceneHandler) processQuery(q *Query) error {
	from := fmt.Sprintf("%d", h.tsdbQuery.TimeRange.GetFromAsMsEpoch())
	to := fmt.Sprintf("%d", h.tsdbQuery.TimeRange.GetToAsMsEpoch())

	minInterval, err := h.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	interval := h.intervalCalculator.Calculate(h.tsdbQuery.TimeRange, minInterval)

	h.queries = append(h.queries, q)

	b := h.ms.Search(interval)
	b.Size(0)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(h.client.GetTimeField(), to, from, es.DateFormatEpochMS)

	if q.RawQuery != "" {
		filters.AddQueryStringFilter(q.RawQuery, true)
	}

	if len(q.BucketAggs) == 0 {
		if len(q.Metrics) == 0 || q.Metrics[0].Type != "raw_document" {
			return nil
		}
		metric := q.Metrics[0]
		b.Size(metric.Settings.Get("size").MustInt(500))
		b.SortDesc("@timestamp", "boolean")
		b.AddDocValueField("@timestamp")
		return nil
	}

	aggBuilder := b.Agg()

	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.BucketAggs {
		switch bucketAgg.Type {
		case dateHistType:
			aggBuilder = addDateHistogramAgg(aggBuilder, bucketAgg, from, to)
		case histogramType:
			aggBuilder = addHistogramAgg(aggBuilder, bucketAgg)
		case filtersType:
			aggBuilder = addFiltersAgg(aggBuilder, bucketAgg)
		case termsType:
			aggBuilder = addTermsAgg(aggBuilder, bucketAgg, q.Metrics)
		case geohashGridType:
			aggBuilder = addGeoHashGridAgg(aggBuilder, bucketAgg)
		}
	}

	for _, m := range q.Metrics {
		m := m
		if m.Type == countType {
			continue
		}

		if isPipelineAgg(m.Type) {
			if isPipelineAggWithMultipleBucketPaths(m.Type) {
				if len(m.PipelineVariables) > 0 {
					bucketPaths := map[string]interface{}{}
					for name, pipelineAgg := range m.PipelineVariables {
						if _, err := strconv.Atoi(pipelineAgg); err == nil {
							var appliedAgg *MetricAgg
							for _, pipelineMetric := range q.Metrics {
								if pipelineMetric.ID == pipelineAgg {
									appliedAgg = pipelineMetric
									break
								}
							}
							if appliedAgg != nil {
								if appliedAgg.Type == countType {
									bucketPaths[name] = "_count"
								} else {
									bucketPaths[name] = pipelineAgg
								}
							}
						}
					}

					aggBuilder.Pipeline(m.ID, m.Type, bucketPaths, func(a *es.PipelineAggregation) {
						a.Settings = m.Settings.MustMap()
					})
				} else {
					continue
				}
			} else {
				if _, err := strconv.Atoi(m.PipelineAggregate); err == nil {
					var appliedAgg *MetricAgg
					for _, pipelineMetric := range q.Metrics {
						if pipelineMetric.ID == m.PipelineAggregate {
							appliedAgg = pipelineMetric
							break
						}
					}
					if appliedAgg != nil {
						bucketPath := m.PipelineAggregate
						if appliedAgg.Type == countType {
							bucketPath = "_count"
						}

						aggBuilder.Pipeline(m.ID, m.Type, bucketPath, func(a *es.PipelineAggregation) {
							a.Settings = m.Settings.MustMap()
						})
					}
				} else {
					continue
				}
			}
		} else {
			aggBuilder.Metric(m.ID, m.Type, m.Field, func(a *es.MetricAggregation) {
				a.Settings = m.Settings.MustMap()
			})
		}
	}

	return nil
}

func (h *luceneHandler) executeQueries() (*tsdb.Response, error) {
	req, err := h.ms.Build()
	if err != nil {
		return nil, err
	}

	res, err := h.client.ExecuteMultisearch(req)
	if err != nil {
		return nil, err
	}

	rp := newResponseParser(res.Responses, h.queries, res.DebugInfo)
	return rp.getTimeSeries()
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo string) es.AggBuilder {
	aggBuilder.DateHistogram(bucketAgg.ID, bucketAgg.Field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

		if a.Interval == "auto" {
			a.Interval = "$__interval"
		}

		if offset, err := bucketAgg.Settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Histogram(bucketAgg.ID, bucketAgg.Field, func(a *es.HistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustInt(1000)
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.Settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addTermsAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, metrics []*MetricAgg) es.AggBuilder {
	aggBuilder.Terms(bucketAgg.ID, bucketAgg.Field, func(a *es.TermsAggregation, b es.AggBuilder) {
		if size, err := bucketAgg.Settings.Get("size").Int(); err == nil {
			a.Size = size
		} else if size, err := bucketAgg.Settings.Get("size").String(); err == nil {
			a.Size, err = strconv.Atoi(size)
			if err != nil {
				a.Size = 500
			}
		} else {
			a.Size = 500
		}
		if a.Size == 0 {
			a.Size = 500
		}

		if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
			a.MinDocCount = &minDocCount
		}
		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if orderBy, err := bucketAgg.Settings.Get("orderBy").String(); err == nil {
			a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")

			if _, err := strconv.Atoi(orderBy); err == nil {
				for _, m := range metrics {
					if m.ID == orderBy {
						b.Metric(m.ID, m.Type, m.Field, nil)
						break
					}
				}
			}
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	filters := make(map[string]interface{})
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

func addGeoHashGridAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.ID, bucketAgg.Field, func(a *es.GeoHashGridAggregation, b es.AggBuilder) {
		a.Precision = bucketAgg.Settings.Get("precision").MustInt(3)
		aggBuilder = b
	})

	return aggBuilder
}
