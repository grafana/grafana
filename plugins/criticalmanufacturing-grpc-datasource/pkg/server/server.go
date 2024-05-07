package server

import (
	"context"
	"fmt"

	"cmf/grafana-datamanager-datasource/pkg/backendapi"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/pkg/errors"
)

type Server struct {
	Datasource    Datasource
	channelPrefix string
	queryMux      *datasource.QueryTypeMux
}

// Make sure SampleDatasource implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin in runtime.
var (
	_ backend.QueryDataHandler      = (*Server)(nil)
	_ backend.CheckHealthHandler    = (*Server)(nil)
	_ instancemgmt.InstanceDisposer = (*Server)(nil)
)

// QueryHandlerFunc is the function signature used for mux.HandleFunc
// Looks like mux.HandleFunc uses backend.QueryHandlerFunc
// type QueryDataHandlerFunc func(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error)
type QueryHandlerFunc func(context.Context, *backend.QueryDataRequest, backend.DataQuery) backend.DataResponse

func DataResponseErrorUnmarshal(err error) backend.DataResponse {
	return backend.DataResponse{
		Error: errors.Wrap(err, "failed to unmarshal JSON request into query"),
	}
}

func DataResponseErrorRequestFailed(err error) backend.DataResponse {
	return backend.DataResponse{
		Error: err,
	}
}

// GetQueryHandlers creates the QueryTypeMux type for handling queries
func getQueryHandlers(s *Server) *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()

	mux.HandleFunc(models.QueryMetricValue, s.HandleGetMetricValueQuery)
	mux.HandleFunc(models.QueryMetricHistory, s.HandleGetMetricHistoryQuery)
	mux.HandleFunc(models.QueryMetricAggregate, s.HandleGetMetricAggregateQuery)
	mux.HandleFunc(models.QueryMetricTable, s.HandleGetMetricTableQuery)
	mux.HandleFunc(models.QueryDimensionKeys, s.HandleListDimensionKeysQuery)
	mux.HandleFunc(models.QueryDimensionValues, s.HandleListDimensionValuesQuery)
	mux.HandleFunc(models.QueryMetrics, s.HandleListMetricsQuery)
	mux.HandleFunc(models.QueryDatasets, s.HandleListDatasetsQuery)

	return mux
}

func NewServerInstance(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	ds, err := backendapi.NewDatasource(settings)
	if err != nil {
		return nil, err
	}
	srvr := &Server{
		Datasource:    ds,
		channelPrefix: fmt.Sprintf("ds/%d/", settings.ID),
	}
	srvr.queryMux = getQueryHandlers(srvr) // init once
	return srvr, nil
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (s *Server) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return s.queryMux.QueryData(ctx, req)
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (s *Server) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	_, err := s.Datasource.HandleListDimensionKeysQuery(ctx, &models.DimensionKeysQuery{})
	if err != nil {
		switch status.Code(err) {
		case codes.Unauthenticated:
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "authentication error; please check if your datasource is provided with valid credentials",
			}, nil
		case codes.Unavailable:
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "could not establish a connection; please check if your datasource is provided with valid credentials",
			}, nil
		default:
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: err.Error(),
			}, nil
		}
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: backend.HealthStatusOk.String(),
	}, nil
}

func (s *Server) Dispose() {
	s.Datasource.Dispose()
}
