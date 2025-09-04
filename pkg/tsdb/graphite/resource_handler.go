package graphite

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type resourceHandler func(context.Context, *datasourceInfo, []byte) ([]byte, int, error)

func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/events", s.handleResourceReq(s.handleEvents))
	mux.HandleFunc("/metrics/find", s.handleResourceReq(s.handleMetricsFind))
	return mux
}

func (s *Service) handleResourceReq(handlerFn resourceHandler) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		pluginCtx := backend.PluginConfigFromContext(req.Context())
		ctx := req.Context()
		dsInfo, err := s.getDSInfo(ctx, pluginCtx)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		defer func() {
			if err := req.Body.Close(); err != nil {
				s.logger.Warn("Failed to close response body", "err", err)
				writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
				return
			}
		}()
		requestBody, err := io.ReadAll(req.Body)
		if err != nil {
			s.logger.Error("Failed to read request body", "error", err)
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		if handlerFn == nil {
			writeErrorResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
			return
		}

		response, statusCode, err := handlerFn(ctx, dsInfo, requestBody)
		if err != nil {
			writeErrorResponse(rw, statusCode, fmt.Sprintf("failed to handle resource request: %v", err))
			return
		}

		rw.WriteHeader(statusCode)
		_, err = rw.Write(response)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("failed to write response: %v", err))
			return
		}
	}
}

func (s *Service) handleEvents(ctx context.Context, dsInfo *datasourceInfo, requestBody []byte) ([]byte, int, error) {
	eventsRequestJson := GraphiteEventsRequest{}
	err := json.Unmarshal(requestBody, &eventsRequestJson)
	if err != nil {
		s.logger.Error("Failed to unmarshal events request body to JSON", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	eventsUrl, err := url.Parse(fmt.Sprintf("%s/events/get_data", dsInfo.URL))
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	queryValues := eventsUrl.Query()
	queryValues.Set("from", eventsRequestJson.From)
	queryValues.Set("until", eventsRequestJson.Until)
	if eventsRequestJson.Tags != "" {
		queryValues.Set("tags", eventsRequestJson.Tags)
	}

	eventsUrl.RawQuery = queryValues.Encode()

	graphiteReq, err := http.NewRequestWithContext(ctx, http.MethodGet, eventsUrl.String(), nil)
	if err != nil {
		s.logger.Info("Failed to create events request", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create events request: %v", err)
	}

	_, span := tracing.DefaultTracer().Start(ctx, "graphite events")
	defer span.End()
	span.SetAttributes(
		attribute.Int64("datasource_id", dsInfo.Id),
	)
	res, err := dsInfo.HTTPClient.Do(graphiteReq)
	if res != nil {
		span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to complete events request: %v", err)
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	events, err := parseResponse[[]GraphiteEventsResponse](res)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to parse events response: %v", err)
	}

	// We construct this struct to avoid frontend changes.
	graphiteEventsResponse, err := json.Marshal(map[string][]GraphiteEventsResponse{
		"data": *events,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal events response: %s", err)
	}

	return graphiteEventsResponse, res.StatusCode, nil
}

func (s *Service) handleMetricsFind(ctx context.Context, dsInfo *datasourceInfo, requestBody []byte) ([]byte, int, error) {
	metricsFindRequestJson := GraphiteMetricsFindRequest{}
	err := json.Unmarshal(requestBody, &metricsFindRequestJson)
	if err != nil {
		s.logger.Error("Failed to unmarshal metrics find request body to JSON", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	if metricsFindRequestJson.Query == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("query is required")
	}

	metricsFindUrl, err := url.Parse(fmt.Sprintf("%s/metrics/find", dsInfo.URL))
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	queryValues := metricsFindUrl.Query()
	if metricsFindRequestJson.From != "" {
		queryValues.Set("from", metricsFindRequestJson.From)
	}
	if metricsFindRequestJson.Until != "" {
		queryValues.Set("until", metricsFindRequestJson.Until)
	}

	data := url.Values{}
	data.Set("query", metricsFindRequestJson.Query)

	graphiteReq, err := http.NewRequestWithContext(ctx, http.MethodPost, metricsFindUrl.String(), strings.NewReader(data.Encode()))
	if err != nil {
		s.logger.Info("Failed to create metrics find request", "error", err)
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create metrics find request: %v", err)
	}
	graphiteReq.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	_, span := tracing.DefaultTracer().Start(ctx, "graphite metrics find")
	defer span.End()
	span.SetAttributes(
		attribute.Int64("datasource_id", dsInfo.Id),
	)
	res, err := dsInfo.HTTPClient.Do(graphiteReq)
	if res != nil {
		span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to complete metrics find request: %v", err)
	}
	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	metrics, err := parseResponse[[]GraphiteMetricsFindResponse](res)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to parse metrics find response: %v", err)
	}

	// We construct this struct to avoid frontend changes.
	metricsFindResponse, err := json.Marshal(map[string][]GraphiteMetricsFindResponse{
		"data": *metrics,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal metrics find response: %s", err)
	}

	return metricsFindResponse, res.StatusCode, nil
}

func parseResponse[V any](res *http.Response) (*V, error) {
	encoding := res.Header.Get("Content-Encoding")
	body, err := decode(encoding, res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	data := new(V)
	err = json.Unmarshal(body, &data)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}
	return data, nil
}

func writeErrorResponse(rw http.ResponseWriter, code int, msg string) {
	rw.WriteHeader(code)
	errorBody := map[string]string{
		"error": msg,
	}
	jsonRes, _ := json.Marshal(errorBody)
	_, err := rw.Write(jsonRes)
	if err != nil {
		backend.Logger.Error("Unable to write HTTP response", "error", err)
	}
}
