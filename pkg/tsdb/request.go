package tsdb

import (
	"context"
)

type HandleRequestFunc func(ctx context.Context, req *TsdbQuery) (*Response, error)

func HandleRequest(ctx context.Context, req *TsdbQuery) (*Response, error) {
	//TODO niceify
	ds := req.Queries[0].DataSource
	endpoint, err := getTsdbQueryEndpointFor(ds)
	if err != nil {
		return nil, err
	}

	res := endpoint.Query(ctx, ds, req)
	if res.Error != nil {
		return nil, res.Error
	}

	return &Response{
		Results:      res.QueryResults,
		BatchTimings: []*BatchTiming{res.Timings},
	}, nil
}
