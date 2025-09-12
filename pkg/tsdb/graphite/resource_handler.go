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

type resourceHandler[T any] func(context.Context, *datasourceInfo, *T) ([]byte, int, error)

func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/events", handleResourceReq(s.handleEvents, s))
	mux.HandleFunc("/metrics/find", handleResourceReq(s.handleMetricsFind, s))
	mux.HandleFunc("/metrics/expand", handleResourceReq(s.handleMetricsExpand, s))
	mux.HandleFunc("/functions", handleResourceReq(s.handleFunctions, s))
	mux.HandleFunc("/tags/autoComplete/tags", handleResourceReq(s.handleTagsAutocomplete, s))
	return mux
}

func handleResourceReq[T any](handlerFn resourceHandler[T], s *Service) func(rw http.ResponseWriter, req *http.Request) {
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
			if req.Body != nil {
				if err := req.Body.Close(); err != nil {
					s.logger.Warn("Failed to close request body", "err", err)
					writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
					return
				}
			}
		}()

		body := []byte{}
		var parsedBody *T
		if req.Body != nil {
			body, err = io.ReadAll(req.Body)
			if err != nil {
				s.logger.Error("Failed to read request body", "error", err)
				writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
				return
			}
			parsedBody, err = parseRequestBody[T](body, s.logger)
			if err != nil {
				writeErrorResponse(rw, http.StatusBadRequest, fmt.Sprintf("failed to parse request body: %v", err))
				return
			}
		}

		if handlerFn == nil {
			writeErrorResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
			return
		}

		response, statusCode, err := handlerFn(ctx, dsInfo, parsedBody)
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

func (s *Service) handleEvents(ctx context.Context, dsInfo *datasourceInfo, eventsRequestJson *GraphiteEventsRequest) ([]byte, int, error) {
	queryParams := map[string]string{
		"from":  eventsRequestJson.From,
		"until": eventsRequestJson.Until,
	}
	if eventsRequestJson.Tags != "" {
		queryParams["tags"] = eventsRequestJson.Tags
	}

	req, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath:     "events/get_data",
		Method:      http.MethodGet,
		QueryParams: queryParams,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create events request %v", err)
	}

	events, _, statusCode, err := doGraphiteRequest[[]GraphiteEventsResponse](ctx, dsInfo, s.logger, req, false)
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

func (s *Service) handleMetricsFind(ctx context.Context, dsInfo *datasourceInfo, metricsFindRequestJson *GraphiteMetricsFindRequest) ([]byte, int, error) {
	if metricsFindRequestJson.Query == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("query is required")
	}

	data := url.Values{}
	data.Set("query", metricsFindRequestJson.Query)

	queryParams := map[string]string{}
	if metricsFindRequestJson.From != "" {
		queryParams["from"] = metricsFindRequestJson.From
	}
	if metricsFindRequestJson.Until != "" {
		queryParams["until"] = metricsFindRequestJson.Until
	}

	req, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath:     "metrics/find",
		Method:      http.MethodPost,
		QueryParams: queryParams,
		Body:        strings.NewReader(data.Encode()),
		Headers:     map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create metrics find request %v", err)
	}

	metrics, _, statusCode, err := doGraphiteRequest[[]GraphiteMetricsFindResponse](ctx, dsInfo, s.logger, req, false)
	if err != nil {
		return nil, statusCode, fmt.Errorf("metrics find request failed: %v", err)
	}

	metricsFindResponse, err := json.Marshal(*metrics)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal metrics find response: %s", err)
	}

	return metricsFindResponse, statusCode, nil
}

func (s *Service) handleMetricsExpand(ctx context.Context, dsInfo *datasourceInfo, metricsExpandRequestJson *GraphiteMetricsFindRequest) ([]byte, int, error) {
	if metricsExpandRequestJson.Query == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("query is required")
	}

	queryParams := map[string]string{
		"query": metricsExpandRequestJson.Query,
	}
	if metricsExpandRequestJson.From != "" {
		queryParams["from"] = metricsExpandRequestJson.From
	}
	if metricsExpandRequestJson.Until != "" {
		queryParams["until"] = metricsExpandRequestJson.Until
	}

	req, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath:     "metrics/expand",
		Method:      http.MethodGet,
		QueryParams: queryParams,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create metrics expand request %v", err)
	}

	metrics, _, statusCode, err := doGraphiteRequest[GraphiteMetricsExpandResponse](ctx, dsInfo, s.logger, req, false)
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

func (s *Service) handleTagsAutocomplete(ctx context.Context, dsInfo *datasourceInfo, tagsAutocompleteRequestJson *GraphiteTagsRequest) ([]byte, int, error) {
	queryParams := map[string]string{
		"from":      tagsAutocompleteRequestJson.From,
		"until":     tagsAutocompleteRequestJson.Until,
		"limit":     fmt.Sprintf("%d", tagsAutocompleteRequestJson.Limit),
		"tagPrefix": tagsAutocompleteRequestJson.TagPrefix,
	}
	req, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath:     "tags/autoComplete/tags",
		Method:      http.MethodGet,
		QueryParams: queryParams,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create metrics expand request %v", err)
	}

	tags, _, statusCode, err := doGraphiteRequest[[]string](ctx, dsInfo, s.logger, req, false)
	if err != nil {
		return nil, statusCode, fmt.Errorf("tags autocomplete request failed: %v", err)
	}

	tagsResponse, err := json.Marshal(tags)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to marshal tags autocomplete response: %s", err)
	}

	return tagsResponse, statusCode, nil
}

func (s *Service) handleFunctions(ctx context.Context, dsInfo *datasourceInfo, _ *any) ([]byte, int, error) {
	req, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath: "functions",
		Method:  http.MethodGet,
	})
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create functions request %v", err)
	}

	_, rawBody, statusCode, err := doGraphiteRequest[map[string]any](ctx, dsInfo, s.logger, req, true)
	if err != nil {
		return nil, statusCode, fmt.Errorf("version request failed: %v", err)
	}

	if rawBody == nil {
		return []byte{}, statusCode, nil
	}

	rawBodyReplaced := bytes.Replace(*rawBody, []byte("\"default\": Infinity"), []byte("\"default\": 1e9999"), -1)
	return rawBodyReplaced, statusCode, nil
}

func doGraphiteRequest[T any](ctx context.Context, dsInfo *datasourceInfo, logger log.Logger, req *http.Request, isRaw bool) (*T, *[]byte, int, error) {
	_, span := tracing.DefaultTracer().Start(ctx, "graphite request")
	defer span.End()
	span.SetAttributes(
		attribute.Int64("datasource_id", dsInfo.Id),
	)
	res, err := dsInfo.HTTPClient.Do(req)
	if res != nil {
		span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
	}
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, http.StatusInternalServerError, fmt.Errorf("failed to complete request: %v", err)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	parsedResponse, rawBody, err := parseResponse[T](res, isRaw, logger)
	if err != nil {
		return nil, nil, http.StatusInternalServerError, fmt.Errorf("failed to parse response: %v", err)
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

func parseResponse[V any](res *http.Response, isRaw bool, logger log.Logger) (*V, *[]byte, error) {
	encoding := res.Header.Get("Content-Encoding")
	body, err := decode(encoding, res.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read response: %v", err)
	}

	if res.StatusCode/100 != 2 {
		logger.Warn("Request failed", "status", res.Status, "body", string(body))
		return nil, nil, fmt.Errorf("request failed, status: %d", res.StatusCode)
	}

	if isRaw {
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
