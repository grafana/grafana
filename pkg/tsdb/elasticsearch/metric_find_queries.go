package elasticsearch

import (
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type fieldsQuery struct {
	client    es.Client
	tsdbQuery *tsdb.TsdbQuery
}

var newFieldsQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) queryEndpoint {
	return &fieldsQuery{
		client:    client,
		tsdbQuery: tsdbQuery,
	}
}

func (e *fieldsQuery) execute() (*tsdb.Response, error) {
	query := e.tsdbQuery.Queries[0]

	im, err := e.client.GetIndexMapping()
	if err != nil {
		return nil, err
	}

	var fieldTypeFilter string
	if typeProp, ok := query.Model.CheckGet("fieldTypeFilter"); ok {
		fieldTypeFilter = typeProp.MustString()
	}

	rt := newFieldsQueryResponseTransformer(im, fieldTypeFilter, query.RefId)
	return rt.transform()
}

var defaultTermsSize = 500

type termsQuery struct {
	client    es.Client
	tsdbQuery *tsdb.TsdbQuery
}

var newTermsQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) queryEndpoint {
	return &termsQuery{
		client:    client,
		tsdbQuery: tsdbQuery,
	}
}

func (e *termsQuery) execute() (*tsdb.Response, error) {
	query := e.tsdbQuery.Queries[0]
	fieldProp, ok := query.Model.CheckGet("field")
	if !ok {
		return nil, fmt.Errorf("required property field is missing")
	}

	field := fieldProp.MustString()
	interval := tsdb.Interval{}
	from := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetFromAsMsEpoch())
	to := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetToAsMsEpoch())

	b := e.client.Search(interval)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(e.client.GetTimeField(), to, from, es.DateFormatEpochMS)

	if q, ok := query.Model.CheckGet("query"); ok {
		filters.AddQueryStringFilter(q.MustString("*"), true)
	}

	size := defaultTermsSize
	if s, ok := query.Model.CheckGet("size"); ok {
		size = s.MustInt(defaultTermsSize)
	}

	b.Size(size)
	b.Agg().Terms("1", field, func(a *es.TermsAggregation, aggBuilder es.AggBuilder) {
		a.Size = size
		a.Order = map[string]interface{}{
			"_term": "asc",
		}
	})

	req, err := b.Build()
	if err != nil {
		return nil, err
	}

	res, err := e.client.ExecuteSearch(req)
	if err != nil {
		return nil, err
	}

	rt := newTermsQueryResponseTransformer(res, "1", query.RefId)
	return rt.transform()
}
