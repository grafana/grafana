package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"go.opentelemetry.io/collector/model/otlp"
)

type Service struct {
	im             instancemgmt.InstanceManager
	tlog           log.Logger
	SearchRequests *SearchRequests
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		tlog:           log.New("tsdb.tempo"),
		im:             datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		SearchRequests: NewSearchStreams(),
	}
}

type TempoDatasource struct {
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

		clientConn, err := grpc.Dial("localhost:9095", grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, err
		}
		streamingClient := tempopb.NewStreamingQuerierClient(clientConn)

		model := &TempoDatasource{
			HTTPClient:      client,
			StreamingClient: streamingClient,
			URL:             settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	s.tlog.Info("QueryData called ", "Queries ", req.Queries)

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		if res, err := s.query(ctx, req.PluginContext, q); err != nil {
			return response, err
		} else {
			// save the response in a hashmap
			// based on with RefID as identifier
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
	case string(dataquery.TempoQueryTypeTraceql):
		fallthrough
	case string(dataquery.TempoQueryTypeTraceqlSearch):
		return s.streamSearch(ctx, pCtx, query)
	}

	return nil, fmt.Errorf("unsupported query type: '%s' for query with refID '%s'", query.QueryType, query.RefID)
}

func (s *Service) streamSearch(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	var sr *tempopb.SearchRequest
	response := &backend.DataResponse{}

	err := json.Unmarshal(query.JSON, &sr)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling query model: %v", err)
		return response, nil
	}

	sr.Start = uint32(query.TimeRange.From.Unix())
	sr.End = uint32(query.TimeRange.To.Unix())

	// generate unique identifier for this stream
	streamPath := SearchPathPrefix + uuid.NewString()

	s.tlog.Info("Adding request to search requests", "streamPath", streamPath)
	if err := s.SearchRequests.add(streamPath, sr); err != nil {
		s.tlog.Error("Error adding request to search requests", "err", err)
	}

	frame := data.NewFrame("response")

	channel := live.Channel{
		Scope:     live.ScopeDatasource,
		Namespace: pCtx.DataSourceInstanceSettings.UID,
		Path:      streamPath,
	}
	frame.SetMeta(&data.FrameMeta{Channel: channel.String()})
	response.Frames = append(response.Frames, frame)

	s.tlog.Info("Return response")

	return response, nil
}

func (s *Service) getTrace(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	result := &backend.DataResponse{}
	refID := query.RefID

	model := &dataquery.TempoQuery{}
	err := json.Unmarshal(query.JSON, model)
	if err != nil {
		return result, err
	}

	dsInfo, err := s.getDSInfo(pCtx)
	if err != nil {
		return nil, err
	}

	request, err := s.createRequest(ctx, dsInfo, model.Query, query.TimeRange.From.Unix(), query.TimeRange.To.Unix())
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
		return &backend.DataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		result.Error = fmt.Errorf("failed to get trace with id: %s Status: %s Body: %s", model.Query, resp.Status, string(body))
		return result, nil
	}

	otTrace, err := otlp.NewProtobufTracesUnmarshaler().UnmarshalTraces(body)

	if err != nil {
		return &backend.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	frame, err := TraceToFrame(otTrace)
	if err != nil {
		return &backend.DataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.Query, err)
	}
	frame.RefID = refID
	frames := []*data.Frame{frame}
	result.Frames = frames
	return result, nil
}

func (s *Service) createRequest(ctx context.Context, dsInfo *TempoDatasource, traceID string, start int64, end int64) (*http.Request, error) {
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

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*TempoDatasource, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*TempoDatasource)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
