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
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
	tracer trace.Tracer
}

type DatasourceInfo struct {
	HTTPClient      *http.Client
	StreamingClient tempopb.StreamingQuerierClient
	URL             string
}

func ProvideService(httpClientProvider *httpclient.Provider, tracer trace.Tracer) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: backend.NewLoggerWith("logger", "tsdb.tempo"),
		tracer: tracer,
	}
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
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	logger := s.logger.FromContext(ctx)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return err
	}
	return callResource(ctx, req, sender, dsInfo, logger, s.tracer)
}

func callResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender, dsInfo *DatasourceInfo, plog log.Logger, tracer trace.Tracer) error {
	tempoURL := "/" + req.URL

	ctx, span := tracer.Start(ctx, "datasource.tempo.CallResource", trace.WithAttributes(
		attribute.String("url", tempoURL),
	))
	defer span.End()

	// Build the full URL
	parsedURL, err := url.Parse(dsInfo.URL)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("Failed to parse datasource URL", "error", err, "url", dsInfo.URL)
		return err
	}

	resourceURL, err := url.Parse(req.URL)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("Failed to parse resource URL", "error", err, "url", req.URL)
		return err
	}

	// Join the paths and preserve query parameters
	parsedURL.RawQuery = resourceURL.RawQuery
	parsedURL.Path = path.Join(parsedURL.Path, resourceURL.Path)

	plog.Debug("Making resource request to Tempo", "url", parsedURL.String())
	start := time.Now()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", parsedURL.String(), nil)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("Failed to create HTTP request", "error", err)
		return err
	}

	resp, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("Failed resource call to Tempo", "error", err, "url", parsedURL.String(), "duration", time.Since(start))
		return err
	}
	defer resp.Body.Close()

	plog.Debug("Response received from Tempo", "statusCode", resp.StatusCode, "contentLength", resp.Header.Get("Content-Length"), "duration", time.Since(start))

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("Failed to read response body", "error", err)
		return err
	}

	respHeaders := map[string][]string{
		"content-type": {"application/json"},
	}
	if encoding := resp.Header.Get("Content-Encoding"); encoding != "" {
		respHeaders["content-encoding"] = []string{encoding}
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  resp.StatusCode,
		Headers: respHeaders,
		Body:    body,
	})
}

// Return the file, line, and (full-path) function name of the caller
func getRunContext() (string, int, string) {
	pc := make([]uintptr, 10)
	runtime.Callers(2, pc)
	f := runtime.FuncForPC(pc[0])
	file, line := f.FileLine(pc[0])
	return file, line, f.Name()
}

// Return a formatted string representing the execution context for the logger
func logEntrypoint() string {
	file, line, pathToFunction := getRunContext()
	parts := strings.Split(pathToFunction, "/")
	functionName := parts[len(parts)-1]
	return fmt.Sprintf("%s:%d[%s]", file, line, functionName)
}
