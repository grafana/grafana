package server

import (
	"context"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func processQueries(ctx context.Context, req *backend.QueryDataRequest, handler QueryHandlerFunc) *backend.QueryDataResponse {
	res := backend.Responses{}
	for _, v := range req.Queries {
		res[v.RefID] = handler(ctx, req, v)
	}

	return &backend.QueryDataResponse{
		Responses: res,
	}
}

func (s *Server) HandleGetMetricValueQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleGetMetricValueQuery), nil
}

func (s *Server) handleGetMetricValueQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToMetricValueQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleGetMetricValueQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleGetMetricHistoryQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleGetMetricHistoryQuery), nil
}

func (s *Server) handleGetMetricHistoryQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToMetricHistoryQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleGetMetricHistoryQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleGetMetricAggregateQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleGetMetricAggregateQuery), nil
}

func (s *Server) handleGetMetricAggregateQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToMetricAggregateQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleGetMetricAggregateQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleGetMetricTableQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleGetMetricTableQuery), nil
}

func (s *Server) handleGetMetricTableQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToMetricTableQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleGetMetricTableQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleListDimensionKeysQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleListDimensionKeysQuery), nil
}

func (s *Server) handleListDimensionKeysQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToDimensionKeysQuery(&q)

	backend.Logger.Info("handleListDimensionKeysQuery (dataset): " + string(query.Dataset))

	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleListDimensionKeysQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleListDimensionValuesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleListDimensionValuesQuery), nil
}

func (s *Server) handleListDimensionValuesQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToDimensionValuesQuery(&q)

	backend.Logger.Info("handleListDimensionValuesQuery (dataset): " + string(query.Dataset))

	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleListDimensionValuesQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleListMetricsQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleListMetricsQuery), nil
}

func (s *Server) handleListMetricsQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToMetricsQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleListMetricsQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}

func (s *Server) HandleListDatasetsQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return processQueries(ctx, req, s.handleListDatasetsQuery), nil
}

func (s *Server) handleListDatasetsQuery(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery) backend.DataResponse {
	query, err := models.UnmarshalToDatasetsQuery(&q)
	if err != nil {
		return DataResponseErrorUnmarshal(err)
	}

	frames, err := s.Datasource.HandleListDatasetsQuery(ctx, query)
	if err != nil {
		return DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: frames,
		Error:  nil,
	}
}
