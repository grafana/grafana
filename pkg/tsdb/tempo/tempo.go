package tempo

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		logger: log.New("tsdb.tempo"),
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

type Datasource struct {
	HTTPClient      *http.Client
	StreamingClient tempopb.StreamingQuerierClient
	URL             string
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		streamingClient, err := newGrpcClient(settings, opts)
		if err != nil {
			return nil, err
		}

		model := &Datasource{
			HTTPClient:      client,
			StreamingClient: streamingClient,
			URL:             settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	s.logger.Debug("QueryData called", "queries", req.Queries)

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		if res, err := s.query(ctx, req.PluginContext, q); err != nil {
			s.logger.Debug("QueryData errored", "query", q, "error", err)
			return response, err
		} else {
			if res != nil {
				response.Responses[q.RefID] = *res
			}
		}
	}

	s.logger.Debug("QueryData succeeded")
	return response, nil
}

func (s *Service) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	s.logger.Debug("query called")

	if query.QueryType == string(dataquery.TempoQueryTypeTraceId) {
		trace, err := s.getTrace(ctx, pCtx, query)
		s.logger.Debug("query succeeded")
		return trace, err
	}

	err := fmt.Errorf("unsupported query type: '%s' for query with refID '%s'", query.QueryType, query.RefID)
	s.logger.Debug("query errored", "error", err)
	return nil, err
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*Datasource, error) {
	s.logger.Debug("getDSInfo called")

	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		s.logger.Debug("getDSInfo errored", "error", err)
		return nil, err
	}

	instance, ok := i.(*Datasource)
	if !ok {
		err := fmt.Errorf("failed to cast datsource info")
		s.logger.Debug("getDSInfo errored", "error", err)
		return nil, err
	}

	s.logger.Debug("getDSInfo succeeded", "url", instance.URL)
	return instance, nil
}
