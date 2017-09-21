package tsdb

import (
	"context"
)

type HandleRequestFunc func(ctx context.Context, req *TsdbQuery) (*Response, error)

func HandleRequest(ctx context.Context, req *TsdbQuery) (*Response, error) {
	//TODO niceify
	endpoint, err := getTsdbQueryEndpointFor(req.Queries[0].DataSource)
	if err != nil {
		return nil, err
	}

	res := endpoint.Query(ctx, req)

	if res.Error != nil {
		return nil, res.Error
	}

	return &Response{
		Results:      res.QueryResults,
		BatchTimings: []*BatchTiming{res.Timings},
	}, nil
}
