package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/collector/model/otlp"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

type Service struct {
	im   instancemgmt.InstanceManager
	tlog log.Logger
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		tlog: log.New("tsdb.tempo"),
		im:   datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
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

	model := &dataquery.TempoQuery{}
	err := json.Unmarshal(req.Queries[0].JSON, model)
	if err != nil {
		return result, err
	}

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	request, err := s.createRequest(ctx, dsInfo, model.Query, req.Queries[0].TimeRange.From.Unix(), req.Queries[0].TimeRange.To.Unix())
	if err != nil {
		return result, err
	}

	resp, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return result, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.tlog.FromContext(ctx).Warn("failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		queryRes.Error = fmt.Errorf("failed to get trace with id: %s Status: %s Body: %s", model.Query, resp.Status, string(body))
		result.Responses[refID] = queryRes
		return result, nil
	}

	otTrace, err := otlp.NewProtobufTracesUnmarshaler().UnmarshalTraces(body)

	if err != nil {
		return &backend.QueryDataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	frame, err := TraceToFrame(otTrace)
	if err != nil {
		return &backend.QueryDataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.Query, err)
	}
	frame.RefID = refID
	frames := []*data.Frame{frame}
	queryRes.Frames = frames
	result.Responses[refID] = queryRes
	return result, nil
}

func (s *Service) createRequest(ctx context.Context, dsInfo *datasourceInfo, traceID string, start int64, end int64) (*http.Request, error) {
	var tempoQuery string
	if start == 0 || end == 0 {
		tempoQuery = fmt.Sprintf("%s/api/traces/%s", dsInfo.URL, traceID)
	} else {
		tempoQuery = fmt.Sprintf("%s/api/traces/%s?start=%d&end=%d", dsInfo.URL, traceID, start, end)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", tempoQuery, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/protobuf")

	s.tlog.FromContext(ctx).Debug("Tempo request", "url", req.URL.String(), "headers", req.Header)
	return req, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
