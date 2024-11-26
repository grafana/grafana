package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gogo/protobuf/proto"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func (s *Service) getTrace(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)
	ctxLogger.Debug("Getting trace", "function", logEntrypoint())

	result := &backend.DataResponse{}
	refID := query.RefID

	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.tempo.getTrace", trace.WithAttributes(
		attribute.String("queryType", query.QueryType),
	))
	defer span.End()

	model := &dataquery.TempoQuery{}
	err := json.Unmarshal(query.JSON, model)
	if err != nil {
		ctxLogger.Error("Failed to unmarshall Tempo query model", "error", err, "function", logEntrypoint())
		return result, err
	}

	dsInfo, err := s.getDSInfo(ctx, pCtx)
	if err != nil {
		ctxLogger.Error("Failed to get datasource information", "error", err, "function", logEntrypoint())
		return nil, err
	}

	if model.Query == nil || *model.Query == "" {
		err := fmt.Errorf("trace id is required")
		ctxLogger.Error("Failed to validate model query", "error", err, "function", logEntrypoint())
		return result, err
	}

	var apiVersion = TraceRequestApiVersionV2
	//nolint:bodyclose
	resp, traceBody, err := s.performTraceRequest(ctx, dsInfo, apiVersion, model, query, span)
	if err != nil {
		return result, err
	}

	// If the endpoint is not found, try the v1 endpoint, we might be communicating with an older Tempo version
	if resp.StatusCode == http.StatusNotFound {
		apiVersion = TraceRequestApiVersionV1
		//nolint:bodyclose
		resp, traceBody, err = s.performTraceRequest(ctx, dsInfo, apiVersion, model, query, span)
		if err != nil {
			return result, err
		}
	}

	if resp.StatusCode != http.StatusOK {
		ctxLogger.Error("Failed to get trace", "error", err, "function", logEntrypoint())
		result.Error = fmt.Errorf("failed to get trace with id: %s Status: %s Body: %s", *model.Query, resp.Status, string(traceBody))
		span.RecordError(result.Error)
		span.SetStatus(codes.Error, result.Error.Error())
		return result, nil
	}

	var frame *data.Frame

	if apiVersion == TraceRequestApiVersionV1 {
		var otTrace tempopb.Trace
		err = proto.Unmarshal(traceBody, &otTrace)

		if err != nil {
			ctxLogger.Error("Failed to convert tempo response to Otlp", "error", err, "function", logEntrypoint())
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return &backend.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
		}

		frame, err = TraceToFrame(otTrace.GetResourceSpans())
		if err != nil {
			ctxLogger.Error("Failed to transform trace to data frame", "error", err, "function", logEntrypoint())
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return &backend.DataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.Query, err)
		}
	} else {
		var tr tempopb.TraceByIDResponse
		err = proto.Unmarshal(traceBody, &tr)

		if err != nil {
			ctxLogger.Error("Failed to convert tempo response to Otlp", "error", err, "function", logEntrypoint())
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return &backend.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
		}

		frame, err = TraceToFrame(tr.Trace.ResourceSpans)
		if err != nil {
			ctxLogger.Error("Failed to transform trace to data frame", "error", err, "function", logEntrypoint())
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return &backend.DataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", model.Query, err)
		}

		if frame == nil {
			result.Status = http.StatusNotFound
			result.Error = fmt.Errorf("failed to get trace with id: %s Status: %s", *model.Query, result.Status)
			span.RecordError(result.Error)
			span.SetStatus(codes.Error, result.Error.Error())
			return result, nil
		}

		frame.Meta.Custom = map[string]interface{}{
			"partial": tr.GetStatus() == tempopb.TraceByIDResponse_PARTIAL,
			"message": tr.GetMessage(),
		}
	}

	frame.RefID = refID
	frames := []*data.Frame{frame}
	result.Frames = frames
	ctxLogger.Debug("Successfully got trace", "function", logEntrypoint())
	return result, nil
}

func (s *Service) performTraceRequest(ctx context.Context, dsInfo *Datasource, apiVersion TraceRequestApiVersion, model *dataquery.TempoQuery, query backend.DataQuery, span trace.Span) (*http.Response, []byte, error) {
	ctxLogger := s.logger.FromContext(ctx)
	request, err := s.createRequest(ctx, dsInfo, apiVersion, *model.Query, query.TimeRange.From.Unix(), query.TimeRange.To.Unix())

	if err != nil {
		ctxLogger.Error("Failed to create request", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, err
	}

	resp, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		ctxLogger.Error("Failed to send request to Tempo", "error", err, "function", logEntrypoint())
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			ctxLogger.Error("Failed to close response body", "error", err, "function", logEntrypoint())
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		ctxLogger.Error("Failed to read response body", "error", err, "function", logEntrypoint())
		return nil, nil, err
	}
	return resp, body, nil
}

type TraceRequestApiVersion int

const (
	TraceRequestApiVersionV1 TraceRequestApiVersion = iota
	TraceRequestApiVersionV2
)

func (s *Service) createRequest(ctx context.Context, dsInfo *Datasource, apiVersion TraceRequestApiVersion, traceID string, start int64, end int64) (*http.Request, error) {
	ctxLogger := s.logger.FromContext(ctx)
	var baseUrl string
	var tempoQuery string

	if apiVersion == TraceRequestApiVersionV1 {
		baseUrl = fmt.Sprintf("%s/api/traces/%s", dsInfo.URL, traceID)
	} else {
		baseUrl = fmt.Sprintf("%s/api/v2/traces/%s", dsInfo.URL, traceID)
	}

	if start == 0 || end == 0 {
		tempoQuery = baseUrl
	} else {
		tempoQuery = fmt.Sprintf("%s?start=%d&end=%d", baseUrl, start, end)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", tempoQuery, nil)
	if err != nil {
		ctxLogger.Error("Failed to create request", "error", err, "function", logEntrypoint())
		return nil, err
	}

	req.Header.Set("Accept", "application/protobuf")
	return req, nil
}
