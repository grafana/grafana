package tempo

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"net/http"
	url2 "net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
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
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		url, err := url2.Parse(settings.URL)
		if err != nil {
			return nil, err
		}
		clientConn, err := grpc.Dial(url.Host, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, err
		}
		streamingClient := tempopb.NewStreamingQuerierClient(clientConn)

		model := &Datasource{
			HTTPClient:      client,
			StreamingClient: streamingClient,
			URL:             settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	s.logger.Info("QueryData called ", "Queries ", req.Queries)

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		if res, err := s.query(ctx, req.PluginContext, q); err != nil {
			return response, err
		} else {
			if res != nil {
				response.Responses[q.RefID] = *res
			}
		}
	}

	return response, nil
}

func (s *Service) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	switch query.QueryType {
	case string(dataquery.TempoQueryTypeTraceId):
		return s.getTrace(ctx, pCtx, query)
	}

	return nil, fmt.Errorf("unsupported query type: '%s' for query with refID '%s'", query.QueryType, query.RefID)
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*Datasource, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*Datasource)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
