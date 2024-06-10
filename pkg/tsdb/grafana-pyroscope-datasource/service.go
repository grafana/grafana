package pyroscope

import (
	"context"
	"fmt"
	"runtime"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Make sure PyroscopeDatasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler, backend.StreamHandler interfaces. Plugin should not
// implement all these interfaces - only those which are required for a particular task.
// For example if plugin does not need streaming functionality then you are free to remove
// methods that implement backend.StreamHandler. Implementing instancemgmt.InstanceDisposer
// is useful to clean up resources used by previous datasource instance when a new datasource
// instance created upon datasource settings changed.
var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
	_ backend.CheckHealthHandler  = (*Service)(nil)
	_ backend.StreamHandler       = (*Service)(nil)
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

var logger = backend.NewLoggerWith("logger", "tsdb.pyroscope")

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

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*PyroscopeDatasource, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		s.logger.FromContext(ctx).Error("Failed to get instance", "error", err, "pluginID", pluginCtx.PluginID, "function", logEntrypoint())
		return nil, err
	}
	in := i.(*PyroscopeDatasource)
	return in, nil
}

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: logger,
	}
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewPyroscopeDatasource(ctx, *httpClientProvider, settings)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)
	ctxLogger.Debug("Processing queries", "queriesLength", len(req.Queries), "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.QueryData(ctx, req)
	if err != nil {
		ctxLogger.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		ctxLogger.Debug("All queries processed", "function", logEntrypoint())
	}
	return response, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Calling resource", "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	err = i.CallResource(ctx, req, sender)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		loggerWithContext.Debug("Health check succeeded", "function", logEntrypoint())
	}
	return err
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Checking health", "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.CheckHealth(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		loggerWithContext.Debug("Health check succeeded", "function", logEntrypoint())
	}
	return response, err
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Subscribing stream", "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.SubscribeStream(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		loggerWithContext.Debug("Stream subscribed", "function", logEntrypoint())
	}
	return response, err
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Running stream", "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	err = i.RunStream(ctx, req, sender)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		loggerWithContext.Debug("Stream run", "function", logEntrypoint())
	}
	return err
}

// PublishStream is called when a client sends a message to the stream.
func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Publishing stream", "function", logEntrypoint())

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.PublishStream(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err, "function", logEntrypoint())
	} else {
		loggerWithContext.Debug("Stream published", "function", logEntrypoint())
	}
	return response, err
}
