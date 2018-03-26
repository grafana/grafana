package elasticsearch

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"strconv"
	"strings"
	"time"
)

var rangeFilterSetting = RangeFilterSetting{Gte: "$timeFrom",
	Lte:    "$timeTo",
	Format: "epoch_millis"}

type Query struct {
	TimeField  string        `json:"timeField"`
	RawQuery   string        `json:"query"`
	BucketAggs []interface{} `json:"bucketAggs"`
	Metrics    []interface{} `json:"metrics"`
	Alias      string        `json:"Alias"`
	Interval   time.Duration
}

func (q *Query) Build(queryContext *tsdb.TsdbQuery, dsInfo *models.DataSource) (string, error) {
	var req Request
	payload := bytes.Buffer{}

	req.Size = 0
	q.renderReqQuery(&req)

	// handle document query
	if q.isRawDocumentQuery() {
		return "", errors.New("alert not support Raw_Document")
	}

	err := q.parseAggs(&req)
	if err != nil {
		return "", err
	}

	reqBytes, err := json.Marshal(req)
	reqHeader := getRequestHeader(queryContext.TimeRange, dsInfo)
	payload.WriteString(reqHeader.String() + "\n")
	payload.WriteString(string(reqBytes) + "\n")
	return q.renderTemplate(payload.String(), queryContext)
}

func (q *Query) isRawDocumentQuery() bool {
	if len(q.BucketAggs) == 0 {
		if len(q.Metrics) > 0 {
			metric := simplejson.NewFromAny(q.Metrics[0])
			if metric.Get("type").MustString("") == "raw_document" {
				return true
			}
		}
	}
	return false
}

func (q *Query) renderReqQuery(req *Request) {
	req.Query = make(map[string]interface{})
	boolQuery := BoolQuery{}
	boolQuery.Filter = append(boolQuery.Filter, newRangeFilter(q.TimeField, rangeFilterSetting))
	boolQuery.Filter = append(boolQuery.Filter, newQueryStringFilter(true, q.RawQuery))
	req.Query["bool"] = boolQuery
}

func (q *Query) parseAggs(req *Request) error {
	aggs := make(Aggs)
	nestedAggs := aggs
	for _, aggRaw := range q.BucketAggs {
		esAggs := make(Aggs)
		aggJson := simplejson.NewFromAny(aggRaw)
		aggType, err := aggJson.Get("type").String()
		if err != nil {
			return err
		}
		id, err := aggJson.Get("id").String()
		if err != nil {
			return err
		}

		switch aggType {
		case "date_histogram":
			esAggs["date_histogram"] = q.getDateHistogramAgg(aggJson)
		case "histogram":
			esAggs["histogram"] = q.getHistogramAgg(aggJson)
		case "filters":
			esAggs["filters"] = q.getFilters(aggJson)
		case "terms":
			terms := q.getTerms(aggJson)
			esAggs["terms"] = terms.Terms
			esAggs["aggs"] = terms.Aggs
		case "geohash_grid":
			return errors.New("alert not support Geo_Hash_Grid")
		}

		if _, ok := nestedAggs["aggs"]; !ok {
			nestedAggs["aggs"] = make(Aggs)
		}

		if aggs, ok := (nestedAggs["aggs"]).(Aggs); ok {
			aggs[id] = esAggs
		}
		nestedAggs = esAggs

	}
	nestedAggs["aggs"] = make(Aggs)

	for _, metricRaw := range q.Metrics {
		metric := make(Metric)
		metricJson := simplejson.NewFromAny(metricRaw)

		id, err := metricJson.Get("id").String()
		if err != nil {
			return err
		}
		metricType, err := metricJson.Get("type").String()
		if err != nil {
			return err
		}
		if metricType == "count" {
			continue
		}

		settings := metricJson.Get("settings").MustMap(map[string]interface{}{})

		if isPipelineAgg(metricType) {
			pipelineAgg := metricJson.Get("pipelineAgg").MustString("")
			if _, err := strconv.Atoi(pipelineAgg); err == nil {
				settings["buckets_path"] = pipelineAgg
			} else {
				continue
			}

		} else {
			settings["field"] = metricJson.Get("field").MustString()
		}

		metric[metricType] = settings
		nestedAggs["aggs"].(Aggs)[id] = metric
	}
	req.Aggs = aggs["aggs"].(Aggs)
	return nil
}

func (q *Query) getDateHistogramAgg(model *simplejson.Json) *DateHistogramAgg {
	agg := &DateHistogramAgg{}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	interval, err := settings.Get("interval").String()
	if err == nil {
		agg.Interval = interval
	}
	agg.Field = q.TimeField
	agg.MinDocCount = settings.Get("min_doc_count").MustInt(0)
	agg.ExtendedBounds = ExtendedBounds{"$timeFrom", "$timeTo"}
	agg.Format = "epoch_millis"

	if agg.Interval == "auto" {
		agg.Interval = "$__interval"
	}

	missing, err := settings.Get("missing").String()
	if err == nil {
		agg.Missing = missing
	}
	return agg
}

func (q *Query) getHistogramAgg(model *simplejson.Json) *HistogramAgg {
	agg := &HistogramAgg{}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	interval, err := settings.Get("interval").String()
	if err == nil {
		agg.Interval = interval
	}
	field, err := model.Get("field").String()
	if err == nil {
		agg.Field = field
	}
	agg.MinDocCount = settings.Get("min_doc_count").MustInt(0)
	missing, err := settings.Get("missing").String()
	if err == nil {
		agg.Missing = missing
	}
	return agg
}

func (q *Query) getFilters(model *simplejson.Json) *FiltersAgg {
	agg := &FiltersAgg{}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	for filter := range settings.Get("filters").MustArray() {
		filterJson := simplejson.NewFromAny(filter)
		query := filterJson.Get("query").MustString("")
		label := filterJson.Get("label").MustString("")
		if label == "" {
			label = query
		}
		agg.Filter[label] = newQueryStringFilter(true, query)
	}
	return agg
}

func (q *Query) getTerms(model *simplejson.Json) *TermsAgg {
	agg := &TermsAgg{Aggs: make(Aggs)}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	agg.Terms.Field = model.Get("field").MustString()
	if settings == nil {
		return agg
	}
	sizeStr := settings.Get("size").MustString("")
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		size = 500
	}
	agg.Terms.Size = size
	orderBy, err := settings.Get("orderBy").String()
	if err == nil {
		agg.Terms.Order = make(map[string]interface{})
		agg.Terms.Order[orderBy] = settings.Get("order").MustString("")
		if _, err := strconv.Atoi(orderBy); err != nil {
			for _, metricI := range q.Metrics {
				metric := simplejson.NewFromAny(metricI)
				metricId := metric.Get("id").MustString()
				if metricId == orderBy {
					subAggs := make(Aggs)
					metricField := metric.Get("field").MustString()
					metricType := metric.Get("type").MustString()
					subAggs[metricType] = map[string]string{"field": metricField}
					agg.Aggs = make(Aggs)
					agg.Aggs[metricId] = subAggs
					break
				}
			}
		}
	}

	missing, err := settings.Get("missing").String()
	if err == nil {
		agg.Terms.Missing = missing
	}

	return agg
}

func (q *Query) renderTemplate(payload string, queryContext *tsdb.TsdbQuery) (string, error) {
	timeRange := queryContext.TimeRange
	interval := intervalCalculator.Calculate(timeRange, q.Interval)
	payload = strings.Replace(payload, "$timeFrom", fmt.Sprintf("%d", timeRange.GetFromAsMsEpoch()), -1)
	payload = strings.Replace(payload, "$timeTo", fmt.Sprintf("%d", timeRange.GetToAsMsEpoch()), -1)
	payload = strings.Replace(payload, "$interval", interval.Text, -1)
	payload = strings.Replace(payload, "$__interval_ms", strconv.FormatInt(interval.Value.Nanoseconds()/int64(time.Millisecond), 10), -1)
	payload = strings.Replace(payload, "$__interval", interval.Text, -1)
	return payload, nil
}
