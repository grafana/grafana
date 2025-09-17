package tempo

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"runtime"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
)

type Service struct {
	im              instancemgmt.InstanceManager
	logger          log.Logger
	tracer          trace.Tracer
	resourceHandler backend.CallResourceHandler
}

type DatasourceInfo struct {
	HTTPClient      *http.Client
	StreamingClient tempopb.StreamingQuerierClient
	URL             string
}

func ProvideService(httpClientProvider *httpclient.Provider, tracer trace.Tracer) *Service {
	s := &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: backend.NewLoggerWith("logger", "tsdb.tempo"),
		tracer: tracer,
	}

	// Set up resource routes using httpadapter
	mux := http.NewServeMux()
	mux.HandleFunc("/tags", s.handleTags)
	mux.HandleFunc("/tag-values", s.handleTagValues)
	s.resourceHandler = httpadapter.New(mux)

	return s
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		ctxLogger := backend.NewLoggerWith("logger", "tsdb.tempo").FromContext(ctx)
		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			ctxLogger.Error("Failed to get HTTP client options", "error", err, "function", logEntrypoint())
			return nil, err
		}

		opts.ForwardHTTPHeaders = true

		client, err := httpClientProvider.New(opts)
		if err != nil {
			ctxLogger.Error("Failed to get HTTP client provider", "error", err, "function", logEntrypoint())
			return nil, err
		}

		streamingClient, err := newGrpcClient(ctx, settings, opts)
		if err != nil {
			ctxLogger.Error("Failed to get gRPC client", "error", err, "function", logEntrypoint())
			return nil, err
		}

		model := &DatasourceInfo{
			HTTPClient:      client,
			StreamingClient: streamingClient,
			URL:             settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)
	ctxLogger.Debug("Processing queries", "queryLength", len(req.Queries), "function", logEntrypoint())

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for i, q := range req.Queries {
		ctxLogger.Debug("Processing query", "counter", i, "function", logEntrypoint())

		var res *backend.DataResponse
		var err error

		switch q.QueryType {
		case string(dataquery.TempoQueryTypeTraceId):
			res, err = s.getTrace(ctx, req.PluginContext, q)
			if err != nil {
				ctxLogger.Error("Error processing TraceId query", "error", err)
				return response, err
			}

		case string(dataquery.TempoQueryTypeTraceqlSearch):
			fallthrough
		case string(dataquery.TempoQueryTypeTraceql):
			res, err = s.runTraceQlQuery(ctx, req.PluginContext, q)
			if err != nil {
				ctxLogger.Error("Error processing TraceQL query", "error", err)
				return response, err
			}

		default:
			return nil, fmt.Errorf("unsupported query type: '%s' for query with refID '%s'", q.QueryType, q.RefID)
		}

		if res != nil {
			ctxLogger.Debug("Query processed", "counter", i, "function", logEntrypoint())
			response.Responses[q.RefID] = *res
		} else {
			ctxLogger.Debug("Query resulted in empty response", "counter", i, "function", logEntrypoint())
		}
	}

	ctxLogger.Debug("All queries processed", "function", logEntrypoint())
	return response, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*DatasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*DatasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}

// handleTags handles requests to /tags resource
func (s *Service) handleTags(rw http.ResponseWriter, req *http.Request) {
	s.proxyToTempo(rw, req, "api/v2/search/tags")
}

// handleTagValues handles requests to /tag-values resource
func (s *Service) handleTagValues(rw http.ResponseWriter, req *http.Request) {
	// Extract the encoded tag from query parameters
	encodedTag := req.URL.Query().Get("tag")
	if encodedTag == "" {
		http.Error(rw, "Missing required 'tag' parameter", http.StatusBadRequest)
		return
	}

	tempoPath := fmt.Sprintf("api/v2/search/tag/%s/values", encodedTag)
	s.proxyToTempo(rw, req, tempoPath)
}

// proxyToTempo is the shared function that builds the URL and proxies requests to Tempo
func (s *Service) proxyToTempo(rw http.ResponseWriter, req *http.Request, tempoPath string) {
	ctx := req.Context()
	pCtx := backend.PluginConfigFromContext(ctx)

	// Get datasource info
	dsInfo, err := s.getDSInfo(ctx, pCtx)
	if err != nil {
		s.logger.Error("Failed to get data source info", "error", err)
		http.Error(rw, "Failed to get data source configuration", http.StatusInternalServerError)
		return
	}

	ctx, span := s.tracer.Start(ctx, "datasource.tempo.proxyToTempo", trace.WithAttributes(
		attribute.String("tempoPath", tempoPath),
	))
	defer span.End()

	// Build the full URL to Tempo
	parsedURL, err := url.Parse(dsInfo.URL)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Failed to parse data source URL", "error", err, "url", dsInfo.URL)
		http.Error(rw, "Invalid data source URL", http.StatusInternalServerError)
		return
	}

	// Join the tempo path with the base URL
	parsedURL.Path = path.Join(parsedURL.Path, tempoPath)
	// Preserve query parameters from the original request
	parsedURL.RawQuery = req.URL.RawQuery

	s.logger.Debug("Making resource request to Tempo", "url", parsedURL.String())
	start := time.Now()

	// Create the request to Tempo
	httpReq, err := http.NewRequestWithContext(ctx, req.Method, parsedURL.String(), req.Body)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Failed to create HTTP request", "error", err)
		http.Error(rw, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Copy headers from the original request
	for name, values := range req.Header {
		for _, value := range values {
			httpReq.Header.Add(name, value)
		}
	}

	// Make the request to Tempo
	resp, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Failed resource call to Tempo", "error", err, "url", parsedURL.String(), "duration", time.Since(start))
		http.Error(rw, "Failed to connect to Tempo", http.StatusBadGateway)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	s.logger.Debug("Response received from Tempo", "statusCode", resp.StatusCode, "contentLength", resp.Header.Get("Content-Length"), "duration", time.Since(start))

	// Copy response headers
	for name, values := range resp.Header {
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	// Set the status code
	rw.WriteHeader(resp.StatusCode)

	// Copy the response body
	_, err = io.Copy(rw, resp.Body)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("Failed to copy response body", "error", err)
		return
	}
}

// Return the file, line, and (full-path) function name of the caller
func getRunContext() (string, int, string) {
	pc := make([]uintptr, 10)
	runtime.Callers(2, pc)
	f := runtime.FuncForPC(pc[0])
	file, line := f.FileLine(pc[0])
	return file, line, f.Name()
}

func logEntrypoint() string {
	file, line, pathToFunction := getRunContext()
	parts := strings.Split(pathToFunction, "/")
	functionName := parts[len(parts)-1]
	return fmt.Sprintf("%s:%d[%s]", file, line, functionName)
}
