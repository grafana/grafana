package elasticsearch

import (
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type pplHandler struct {
	client    es.Client
	tsdbQuery *tsdb.TsdbQuery
	builders  map[string]*es.PPLRequestBuilder
}

var newPPLHandler = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) *pplHandler {
	return &pplHandler{
		client:    client,
		tsdbQuery: tsdbQuery,
		builders:  make(map[string]*es.PPLRequestBuilder),
	}
}

func (h *pplHandler) processQuery(q *Query) error {
	from := h.tsdbQuery.TimeRange.MustGetFrom().Local().Format("2006-01-02 15:04:05")
	to := h.tsdbQuery.TimeRange.MustGetTo().Local().Format("2006-01-02 15:04:05")

	builder := h.client.PPL()
	builder.AddPPLQueryString(h.client.GetTimeField(), to, from, q.RawQuery)
	h.builders[q.RefID] = builder
	return nil
}

func (h *pplHandler) executeQueries() (*tsdb.Response, error) {
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	for refID, builder := range h.builders {
		req, err := builder.Build()
		if err != nil {
			return nil, err
		}
		res, err := h.client.ExecutePPLQuery(req)
		if err != nil {
			return nil, err
		}
		rp := newPPLResponseParser(res)
		queryRes, err := rp.parseTimeSeries()
		if err != nil {
			return nil, err
		}
		result.Results[refID] = queryRes
	}
	return result, nil
}
