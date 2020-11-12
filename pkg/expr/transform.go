package expr

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/net/context"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func WrapTransformData(ctx context.Context, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	sdkReq := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			// TODO: Things probably
		},
		Queries: []backend.DataQuery{},
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		sdkReq.Queries = append(sdkReq.Queries, backend.DataQuery{
			JSON:          modelJSON,
			Interval:      time.Duration(q.IntervalMs) * time.Millisecond,
			RefID:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
			QueryType:     q.QueryType,
			TimeRange: backend.TimeRange{
				From: query.TimeRange.GetFromAsTimeUTC(),
				To:   query.TimeRange.GetFromAsTimeUTC(),
			},
		})
	}
	pbRes, err := TransformData(ctx, sdkReq)
	if err != nil {
		return nil, err
	}

	tR := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult, len(pbRes.Responses)),
	}
	for refID, res := range pbRes.Responses {
		tRes := &tsdb.QueryResult{
			RefId:      refID,
			Dataframes: tsdb.NewDecodedDataFrames(res.Frames),
		}
		// if len(res.JsonMeta) != 0 {
		// 	tRes.Meta = simplejson.NewFromAny(res.JsonMeta)
		// }
		if res.Error != nil {
			tRes.Error = res.Error
			tRes.ErrorString = res.Error.Error()
		}
		tR.Results[refID] = tRes
	}

	return tR, nil
}

// TransformData takes Queries which are either expressions nodes
// or are datasource requests.
func TransformData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	svc := Service{}
	// Build the pipeline from the request, checking for ordering issues (e.g. loops)
	// and parsing graph nodes from the queries.
	pipeline, err := svc.BuildPipeline(req.Queries)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	// Execute the pipeline
	responses, err := svc.ExecutePipeline(ctx, pipeline)
	if err != nil {
		return nil, status.Error(codes.Unknown, err.Error())
	}

	// Get which queries have the Hide property so they those queries' results
	// can be excluded from the response.
	hidden, err := hiddenRefIDs(req.Queries)
	if err != nil {
		return nil, status.Error((codes.Internal), err.Error())
	}

	if len(hidden) != 0 {
		filteredRes := backend.NewQueryDataResponse()
		for refID, res := range responses.Responses {
			if _, ok := hidden[refID]; !ok {
				filteredRes.Responses[refID] = res
			}
		}
		responses = filteredRes
	}

	return responses, nil

}

func hiddenRefIDs(queries []backend.DataQuery) (map[string]struct{}, error) {
	hidden := make(map[string]struct{})

	for _, query := range queries {
		hide := struct {
			Hide bool `json:"hide"`
		}{}

		if err := json.Unmarshal(query.JSON, &hide); err != nil {
			return nil, err
		}

		if hide.Hide {
			hidden[query.RefID] = struct{}{}
		}
	}
	return hidden, nil
}
