package expr

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Service is service representation for expression handling.
type Service struct {
}

// BuildPipeline builds a pipeline from a request.
func (s *Service) BuildPipeline(queries []backend.DataQuery) (DataPipeline, error) {
	return buildPipeline(queries)
}

// ExecutePipeline executes an expression pipeline and returns all the results.
func (s *Service) ExecutePipeline(ctx context.Context, pipeline DataPipeline) (*backend.QueryDataResponse, error) {
	res := backend.NewQueryDataResponse()
	vars, err := pipeline.execute(ctx)
	if err != nil {
		return nil, err
	}
	for refID, val := range vars {
		res.Responses[refID] = backend.DataResponse{
			Frames: val.Values.AsDataFrames(refID),
		}
	}
	return res, nil
}
