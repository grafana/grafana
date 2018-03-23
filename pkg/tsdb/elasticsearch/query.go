package elasticsearch

import (
	"errors"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

var rangeFilterSetting = RangeFilterSetting{Gte: "$timeFrom",
	Lte:    "$timeTo",
	Format: "epoch_millis"}

type QueryBuilder struct {
	TimeField  string
	RawQuery   string
	BucketAggs []interface{}
	Metrics    []interface{}
	Alias      string
}

func (b *QueryBuilder) Build() (Query, error) {
	var err error
	var res Query
	res.Query = make(map[string]interface{})
	res.Size = 0

	if err != nil {
		return res, err
	}

	boolQuery := BoolQuery{}
	boolQuery.Filter = append(boolQuery.Filter, newRangeFilter(b.TimeField, rangeFilterSetting))
	boolQuery.Filter = append(boolQuery.Filter, newQueryStringFilter(true, b.RawQuery))
	res.Query["bool"] = boolQuery

	// handle document query
	if len(b.BucketAggs) == 0 {
		if len(b.Metrics) > 0 {
			metric := simplejson.NewFromAny(b.Metrics[0])
			if metric.Get("type").MustString("") == "raw_document" {
				return res, errors.New("alert not support Raw_Document")
			}
		}
	}
	aggs, err := b.parseAggs(b.BucketAggs, b.Metrics)
	res.Aggs = aggs["aggs"].(Aggs)

	return res, err
}

func (b *QueryBuilder) parseAggs(bucketAggs []interface{}, metrics []interface{}) (Aggs, error) {
	query := make(Aggs)
	nestedAggs := query
	for _, aggRaw := range bucketAggs {
		esAggs := make(Aggs)
		aggJson := simplejson.NewFromAny(aggRaw)
		aggType, err := aggJson.Get("type").String()
		if err != nil {
			return nil, err
		}
		id, err := aggJson.Get("id").String()
		if err != nil {
			return nil, err
		}

		switch aggType {
		case "date_histogram":
			esAggs["date_histogram"] = b.getDateHistogramAgg(aggJson)
		case "histogram":
			esAggs["histogram"] = b.getHistogramAgg(aggJson)
		case "filters":
			esAggs["filters"] = b.getFilters(aggJson)
		case "terms":
			terms := b.getTerms(aggJson)
			esAggs["terms"] = terms.Terms
			esAggs["aggs"] = terms.Aggs
		case "geohash_grid":
			return nil, errors.New("alert not support Geo_Hash_Grid")
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

	for _, metricRaw := range metrics {
		metric := make(Metric)
		metricJson := simplejson.NewFromAny(metricRaw)

		id, err := metricJson.Get("id").String()
		if err != nil {
			return nil, err
		}
		metricType, err := metricJson.Get("type").String()
		if err != nil {
			return nil, err
		}
		if metricType == "count" {
			continue
		}

		// todo support pipeline Agg

		settings := metricJson.Get("settings").MustMap()
		settings["field"] = metricJson.Get("field").MustString()
		metric[metricType] = settings
		nestedAggs["aggs"].(Aggs)[id] = metric
	}
	return query, nil
}

func (b *QueryBuilder) getDateHistogramAgg(model *simplejson.Json) DateHistogramAgg {
	agg := &DateHistogramAgg{}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	interval, err := settings.Get("interval").String()
	if err == nil {
		agg.Interval = interval
	}
	agg.Field = b.TimeField
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
	return *agg
}

func (b *QueryBuilder) getHistogramAgg(model *simplejson.Json) HistogramAgg {
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
	return *agg
}

func (b *QueryBuilder) getFilters(model *simplejson.Json) FiltersAgg {
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
	return *agg
}

func (b *QueryBuilder) getTerms(model *simplejson.Json) TermsAgg {
	agg := &TermsAgg{}
	settings := simplejson.NewFromAny(model.Get("settings").Interface())
	agg.Terms.Field = model.Get("field").MustString()
	if settings == nil {
		return *agg
	}
	agg.Terms.Size = settings.Get("size").MustInt(0)
	if agg.Terms.Size == 0 {
		agg.Terms.Size = 500
	}
	orderBy := settings.Get("orderBy").MustString("")
	if orderBy != "" {
		agg.Terms.Order[orderBy] = settings.Get("order").MustString("")
		//	 if orderBy is a int, means this fields is metric result value
		//	 TODO set subAggs
	}

	minDocCount, err := settings.Get("min_doc_count").Int()
	if err == nil {
		agg.Terms.MinDocCount = minDocCount
	}

	missing, err := settings.Get("missing").String()
	if err == nil {
		agg.Terms.Missing = missing
	}

	return *agg
}
