package elasticsearch

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/leibowitz/moment"
)

var rangeFilterSetting = RangeFilterSetting{Gte: "$timeFrom",
	Lte:    "$timeTo",
	Format: "epoch_millis"}

type Query struct {
	TimeField  string       `json:"timeField"`
	RawQuery   string       `json:"query"`
	BucketAggs []*BucketAgg `json:"bucketAggs"`
	Metrics    []*Metric    `json:"metrics"`
	Alias      string       `json:"alias"`
	Interval   time.Duration
}

func (q *Query) Build(queryContext *tsdb.TsdbQuery, dsInfo *models.DataSource) (string, error) {
	var req Request
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
	payload := bytes.Buffer{}
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
	for _, agg := range q.BucketAggs {
		esAggs := make(Aggs)
		switch agg.Type {
		case "date_histogram":
			esAggs["date_histogram"] = q.getDateHistogramAgg(agg)
		case "histogram":
			esAggs["histogram"] = q.getHistogramAgg(agg)
		case "filters":
			esAggs["filters"] = q.getFilters(agg)
		case "terms":
			terms := q.getTerms(agg)
			esAggs["terms"] = terms.Terms
			esAggs["aggs"] = terms.Aggs
		case "geohash_grid":
			return errors.New("alert not support Geo_Hash_Grid")
		}

		if _, ok := nestedAggs["aggs"]; !ok {
			nestedAggs["aggs"] = make(Aggs)
		}

		if aggs, ok := (nestedAggs["aggs"]).(Aggs); ok {
			aggs[agg.ID] = esAggs
		}
		nestedAggs = esAggs

	}
	nestedAggs["aggs"] = make(Aggs)

	for _, metric := range q.Metrics {
		subAgg := make(Aggs)

		if metric.Type == "count" {
			continue
		}
		settings := metric.Settings.MustMap(make(map[string]interface{}))

		if isPipelineAgg(metric.Type) {
			if _, err := strconv.Atoi(metric.PipelineAggregate); err == nil {
				settings["buckets_path"] = metric.PipelineAggregate
			} else {
				continue
			}

		} else {
			settings["field"] = metric.Field
		}

		subAgg[metric.Type] = settings
		nestedAggs["aggs"].(Aggs)[metric.ID] = subAgg
	}
	req.Aggs = aggs["aggs"].(Aggs)
	return nil
}

func (q *Query) getDateHistogramAgg(target *BucketAgg) *DateHistogramAgg {
	agg := &DateHistogramAgg{}
	interval, err := target.Settings.Get("interval").String()
	if err == nil {
		agg.Interval = interval
	}
	agg.Field = q.TimeField
	agg.MinDocCount = target.Settings.Get("min_doc_count").MustInt(0)
	agg.ExtendedBounds = ExtendedBounds{"$timeFrom", "$timeTo"}
	agg.Format = "epoch_millis"

	if agg.Interval == "auto" {
		agg.Interval = "$__interval"
	}

	missing, err := target.Settings.Get("missing").String()
	if err == nil {
		agg.Missing = missing
	}
	return agg
}

func (q *Query) getHistogramAgg(target *BucketAgg) *HistogramAgg {
	agg := &HistogramAgg{}
	interval, err := target.Settings.Get("interval").String()
	if err == nil {
		agg.Interval = interval
	}

	if target.Field != "" {
		agg.Field = target.Field
	}
	agg.MinDocCount = target.Settings.Get("min_doc_count").MustInt(0)
	missing, err := target.Settings.Get("missing").String()
	if err == nil {
		agg.Missing = missing
	}
	return agg
}

func (q *Query) getFilters(target *BucketAgg) *FiltersAgg {
	agg := &FiltersAgg{}
	agg.Filters = map[string]interface{}{}
	for _, filter := range target.Settings.Get("filters").MustArray() {
		filterJson := simplejson.NewFromAny(filter)
		query := filterJson.Get("query").MustString("")
		label := filterJson.Get("label").MustString("")
		if label == "" {
			label = query
		}

		agg.Filters[label] = newQueryStringFilter(true, query)
	}
	return agg
}

func (q *Query) getTerms(target *BucketAgg) *TermsAggWrap {
	agg := &TermsAggWrap{Aggs: make(Aggs)}
	agg.Terms.Field = target.Field
	if len(target.Settings.MustMap()) == 0 {
		return agg
	}
	sizeStr := target.Settings.Get("size").MustString("")
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		size = 500
	}
	agg.Terms.Size = size
	orderBy, err := target.Settings.Get("orderBy").String()
	if err == nil {
		agg.Terms.Order = make(map[string]interface{})
		agg.Terms.Order[orderBy] = target.Settings.Get("order").MustString("")
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

	missing, err := target.Settings.Get("missing").String()
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

func getRequestHeader(timeRange *tsdb.TimeRange, dsInfo *models.DataSource) *QueryHeader {
	var header QueryHeader
	esVersion := dsInfo.JsonData.Get("esVersion").MustInt()

	searchType := "query_then_fetch"
	if esVersion < 5 {
		searchType = "count"
	}
	header.SearchType = searchType
	header.IgnoreUnavailable = true
	header.Index = getIndexList(dsInfo.Database, dsInfo.JsonData.Get("interval").MustString(), timeRange)

	if esVersion >= 56 {
		header.MaxConcurrentShardRequests = dsInfo.JsonData.Get("maxConcurrentShardRequests").MustInt()
	}
	return &header
}

func getIndexList(pattern string, interval string, timeRange *tsdb.TimeRange) string {
	if interval == "" {
		return pattern
	}

	var indexes []string
	indexParts := strings.Split(strings.TrimLeft(pattern, "["), "]")
	indexBase := indexParts[0]
	if len(indexParts) <= 1 {
		return pattern
	}

	indexDateFormat := indexParts[1]

	start := moment.NewMoment(timeRange.MustGetFrom())
	end := moment.NewMoment(timeRange.MustGetTo())

	indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.Format(indexDateFormat)))
	for start.IsBefore(*end) {
		switch interval {
		case "Hourly":
			start = start.AddHours(1)

		case "Daily":
			start = start.AddDay()

		case "Weekly":
			start = start.AddWeeks(1)

		case "Monthly":
			start = start.AddMonths(1)

		case "Yearly":
			start = start.AddYears(1)
		}
		indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.Format(indexDateFormat)))
	}
	return strings.Join(indexes, ",")
}
