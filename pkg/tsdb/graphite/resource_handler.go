package graphite

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type postResourceHandler[T any] func(context.Context, *datasourceInfo, T) ([]byte, int, error)
type getResourceHandler func(context.Context, *datasourceInfo) ([]byte, int, error)

func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/events", handlePostResourceReq(s.handleEvents, s))
	mux.HandleFunc("/metrics/find", handlePostResourceReq(s.handleMetricsFind, s))
	mux.HandleFunc("/metrics/expand", handlePostResourceReq(s.handleMetricsExpand, s))
	mux.HandleFunc("/functions", handleGetResourceReq(s.handleFunctions, s))
	return mux
}

func handlePostResourceReq[T any](handlerFn postResourceHandler[T], s *Service) func(rw http.ResponseWriter, req *http.Request) {
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
				s.logger.Warn("Failed to close request body", "err", err)
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

		parsedBody, err := parseRequestBody[T](requestBody, s.logger)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("failed to parse request body: %v", err))
			return
		}

		response, statusCode, err := handlerFn(ctx, dsInfo, *parsedBody)
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

func handleGetResourceReq(handlerFn getResourceHandler, s *Service) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		pluginCtx := backend.PluginConfigFromContext(req.Context())
		ctx := req.Context()
		dsInfo, err := s.getDSInfo(ctx, pluginCtx)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		if handlerFn == nil {
			writeErrorResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
			return
		}

		response, statusCode, err := handlerFn(ctx, dsInfo)
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

func (s *Service) handleEvents(ctx context.Context, dsInfo *datasourceInfo, eventsRequestJson GraphiteEventsRequest) ([]byte, int, error) {
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

	events, _, statusCode, err := doGraphiteRequest[[]GraphiteEventsResponse](ctx, "events", dsInfo, eventsUrl, http.MethodGet, nil, map[string]string{}, s.logger, false)
	if err != nil {
		return nil, statusCode, fmt.Errorf("events request failed: %v", err)
	}

	// We construct this struct to avoid frontend changes.
	graphiteEventsResponse, err := json.Marshal(map[string][]GraphiteEventsResponse{
		"data": *events,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal events response: %s", err)
	}

	return graphiteEventsResponse, statusCode, nil
}

func (s *Service) handleMetricsFind(ctx context.Context, dsInfo *datasourceInfo, metricsFindRequestJson GraphiteMetricsFindRequest) ([]byte, int, error) {
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

	metrics, _, statusCode, err := doGraphiteRequest[[]GraphiteMetricsFindResponse](ctx, "metrics find", dsInfo, metricsFindUrl, http.MethodPost, strings.NewReader(data.Encode()), map[string]string{"Content-Type": "application/x-www-form-urlencoded"}, s.logger, false)
	if err != nil {
		return nil, statusCode, fmt.Errorf("metrics find request failed: %v", err)
	}

	metricsFindResponse, err := json.Marshal(*metrics)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal metrics find response: %s", err)
	}

	return metricsFindResponse, statusCode, nil
}

func (s *Service) handleMetricsExpand(ctx context.Context, dsInfo *datasourceInfo, metricsExpandRequestJson GraphiteMetricsFindRequest) ([]byte, int, error) {
	if metricsExpandRequestJson.Query == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("query is required")
	}

	metricsExpandUrl, err := url.Parse(fmt.Sprintf("%s/metrics/expand", dsInfo.URL))
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
	}

	queryValues := metricsExpandUrl.Query()
	queryValues.Set("query", metricsExpandRequestJson.Query)
	if metricsExpandRequestJson.From != "" {
		queryValues.Set("from", metricsExpandRequestJson.From)
	}
	if metricsExpandRequestJson.Until != "" {
		queryValues.Set("until", metricsExpandRequestJson.Until)
	}
	metricsExpandUrl.RawQuery = queryValues.Encode()

	metrics, _, statusCode, err := doGraphiteRequest[GraphiteMetricsExpandResponse](ctx, "metrics expand", dsInfo, metricsExpandUrl, http.MethodGet, nil, map[string]string{}, s.logger, false)
	if err != nil {
		return nil, statusCode, fmt.Errorf("metrics expand request failed: %v", err)
	}

	metricsResponse := make([]GraphiteMetricsFindResponse, 0, len(metrics.Results))
	for _, metric := range metrics.Results {
		metricsResponse = append(metricsResponse, GraphiteMetricsFindResponse{
			Text: metric,
		})
	}

	metricsExpandResponse, err := json.Marshal(metricsResponse)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal metrics expand response: %s", err)
	}

	return metricsExpandResponse, statusCode, nil
}

func doGraphiteRequest[T any](ctx context.Context, endpoint string, dsInfo *datasourceInfo, url *url.URL, method string, body io.Reader, headers map[string]string, logger log.Logger, rawResponse bool) (*T, *[]byte, int, error) {
	graphiteReq, err := http.NewRequestWithContext(ctx, method, url.String(), body)
	if err != nil {
		logger.Info(fmt.Sprintf("Failed to create %s request", endpoint), "error", err)
		return nil, nil, http.StatusInternalServerError, fmt.Errorf("failed to create %s request: %v", endpoint, err)
	}

	for k, v := range headers {
		graphiteReq.Header.Add(k, v)
	}

	_, span := tracing.DefaultTracer().Start(ctx, fmt.Sprintf("graphite %s", endpoint))
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
		return nil, nil, http.StatusInternalServerError, fmt.Errorf("failed to complete %s request: %v", endpoint, err)
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			logger.Warn("Failed to close response body", "error", err)
		}
	}()

	parsedResponse, rawBody, err := parseResponse[T](res, rawResponse, logger)
	if err != nil {
		return nil, nil, res.StatusCode, fmt.Errorf("failed to parse %s response: %v", endpoint, err)
	}

	return parsedResponse, rawBody, res.StatusCode, nil
}

func parseRequestBody[V any](requestBody []byte, logger log.Logger) (*V, error) {
	requestJson := new(V)
	err := json.Unmarshal(requestBody, &requestJson)
	if err != nil {
		logger.Error("Failed to unmarshal request body to JSON", "error", err)
		return nil, fmt.Errorf("unexpected error %v", err)
	}
	return requestJson, nil
}

func parseResponse[V any](res *http.Response, raw bool, logger log.Logger) (*V, *[]byte, error) {
	encoding := res.Header.Get("Content-Encoding")
	body, err := decode(encoding, res.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read response: %v", err)
	}

	if res.StatusCode/100 != 2 {
		logger.Warn("Request failed", "status", res.Status, "body", string(body))
		return nil, nil, fmt.Errorf("request failed, status: %d", res.StatusCode)
	}

	if raw {
		return nil, &body, nil
	}

	data := new(V)
	err = json.Unmarshal(body, &data)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}
	return data, nil, nil
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
