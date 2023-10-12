package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"go.opentelemetry.io/collector/pdata/ptrace"
)

func (s *Service) getTrace(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	s.logger.Debug("getTrace called")

	result := &backend.DataResponse{}
	refID := query.RefID

	model := &dataquery.TempoQuery{}
	err := json.Unmarshal(query.JSON, model)
	if err != nil {
		s.logger.Debug("getTrace errored", "error", err)
		return result, err
	}

	dsInfo, err := s.getDSInfo(ctx, pCtx)
	if err != nil {
		s.logger.Debug("getTrace errored", "error", err)
		return nil, err
	}

	if model.Query == nil || *model.Query == "" {
		err := fmt.Errorf("trace id is required")
		s.logger.Debug("getTrace errored", "error", err)
		return result, err
	}

	request, err := s.createRequest(ctx, dsInfo, *model.Query, query.TimeRange.From.Unix(), query.TimeRange.To.Unix())
	if err != nil {
		s.logger.Debug("getTrace errored", "error", err)
		return result, err
	}

	resp, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		s.logger.Debug("getTrace errored", "error", err)
		return result, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.logger.FromContext(ctx).Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		s.logger.Debug("getTrace errored", "error", err)
		return &backend.DataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		result.Error = fmt.Errorf("failed to get trace with id: %v Status: %s Body: %s", model.Query, resp.Status, string(body))
		s.logger.Debug("getTrace errored", "error", result.Error)
		return result, nil
	}

	pbUnmarshaler := ptrace.ProtoUnmarshaler{}
	otTrace, err := pbUnmarshaler.UnmarshalTraces(body)

	if err != nil {
		s.logger.Debug("getTrace errored", "error", result.Error)
		return &backend.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	frame, err := TraceToFrame(otTrace)
	if err != nil {
		s.logger.Debug("getTrace errored", "error", result.Error)
		return &backend.DataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.Query, err)
	}

	frame.RefID = refID
	frames := []*data.Frame{frame}
	result.Frames = frames
	s.logger.Debug("getTrace succeeded")
	return result, nil
}

func (s *Service) createRequest(ctx context.Context, dsInfo *Datasource, traceID string, start int64, end int64) (*http.Request, error) {
	s.logger.Debug("createRequest called")

	var tempoQuery string
	if start == 0 || end == 0 {
		tempoQuery = fmt.Sprintf("%s/api/traces/%s", dsInfo.URL, traceID)
	} else {
		tempoQuery = fmt.Sprintf("%s/api/traces/%s?start=%d&end=%d", dsInfo.URL, traceID, start, end)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", tempoQuery, nil)
	if err != nil {
		s.logger.Debug("createRequest errored", "error", err)
		return nil, err
	}

	req.Header.Set("Accept", "application/protobuf")

	s.logger.FromContext(ctx).Debug("createRequest succeeded", "url", req.URL.String(), "headers", req.Header)
	return req, nil
}
