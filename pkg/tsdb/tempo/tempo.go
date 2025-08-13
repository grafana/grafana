package tempo

import (
	"context"
	"fmt"
	"net/http"
	"runtime"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

type DatasourceInfo struct {
	HTTPClient      *http.Client
	StreamingClient tempopb.StreamingQuerierClient
	URL             string
}

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: backend.NewLoggerWith("logger", "tsdb.tempo"),
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
