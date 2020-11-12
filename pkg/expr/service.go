package expr

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

// Service is service representation for GEL.
type Service struct {
	//CallBack backend.TransformDataCallBackHandler
}

// BuildPipeline builds a pipeline from a request.
func (s *Service) BuildPipeline(queries []backend.DataQuery) (DataPipeline, error) {
	return buildPipeline(queries)
}

// ExecutePipeline executes a GEL data pipeline and returns all the results.
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

func extractDataFrames(vars mathexp.Vars) []*data.Frame {
	res := []*data.Frame{}
	for refID, results := range vars {
		for _, val := range results.Values {
			df := val.AsDataFrame()
			df.RefID = refID
			res = append(res, df)
		}
	}
	return res
}
