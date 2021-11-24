package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/collector/model/otlp"
)

const pluginID = "tempo"

type Service struct {
	im   instancemgmt.InstanceManager
	tlog log.Logger
}

func ProvideService(httpClientProvider httpclient.Provider, pluginStore plugins.Store, cfg *setting.Cfg) (*Service, error) {
	im := datasource.NewInstanceManager(newInstanceSettings(httpClientProvider))

	s := &Service{
		tlog: log.New("tsdb.tempo"),
		im:   im,
	}

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	resolver := plugins.CoreBackendPluginPathResolver(cfg, pluginID)
	if err := pluginStore.AddWithFactory(context.Background(), pluginID, factory, resolver); err != nil {
		s.tlog.Error("Failed to register plugin", "error", err)
		return nil, err
	}

	return s, nil
}

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
}

type QueryModel struct {
	TraceID string `json:"query"`
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

		model := &datasourceInfo{
			HTTPClient: client,
			URL:        settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	queryRes := backend.DataResponse{}
	refID := req.Queries[0].RefID

	model := &QueryModel{}
	err := json.Unmarshal(req.Queries[0].JSON, model)
	if err != nil {
		return result, err
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	request, err := s.createRequest(ctx, dsInfo, model.TraceID)
	if err != nil {
		return result, err
	}

	resp, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return result, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.tlog.Warn("failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		queryRes.Error = fmt.Errorf("failed to get trace with id: %s Status: %s Body: %s", model.TraceID, resp.Status, string(body))
		result.Responses[refID] = queryRes
		return result, nil
	}

	otTrace, err := otlp.NewProtobufTracesUnmarshaler().UnmarshalTraces(body)

	if err != nil {
		return &backend.QueryDataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	frame, err := TraceToFrame(otTrace)
	if err != nil {
		return &backend.QueryDataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.TraceID, err)
	}
	frame.RefID = refID
	frames := []*data.Frame{frame}
	queryRes.Frames = frames
	result.Responses[refID] = queryRes
	return result, nil
}

func (s *Service) createRequest(ctx context.Context, dsInfo *datasourceInfo, traceID string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", dsInfo.URL+"/api/traces/"+traceID, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/protobuf")

	s.tlog.Debug("Tempo request", "url", req.URL.String(), "headers", req.Header)
	return req, nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
