package graphite

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"go.opentelemetry.io/otel/trace"
)

// Config carries the operator-tunable safety caps that bound per-request
// memory consumption. A zero value on any field means "use the built-in
// default". The Grafana-core wiring layer (which is allowed to import
// pkg/setting) is responsible for populating this struct from
// [tsdb.graphite] ini keys; this package stays free of any Grafana-core
// dependency so it can also build as an external plugin.
type Config struct {
	RenderResponseMaxBytes   int64
	ResourceResponseMaxBytes int64
	ResourceRequestMaxBytes  int64
}

type Service struct {
	im              instancemgmt.InstanceManager
	tracer          trace.Tracer
	logger          log.Logger
	resourceHandler backend.CallResourceHandler
	HTTPClient      *http.Client

	// Safety caps. Zero falls back to the package-level defaults
	// (defaultRenderResponseMaxBytes, defaultResourceResponseMaxBytes,
	// defaultResourceRequestMaxBytes).
	renderResponseMaxBytes   int64
	resourceResponseMaxBytes int64
	resourceRequestMaxBytes  int64
}

const (
	TargetFullModelField = "targetFull"
	TargetModelField     = "target"
)

func ProvideService(httpClientProvider *httpclient.Provider, tracer trace.Tracer) *Service {
	logger := backend.NewLoggerWith("logger", "graphite")
	s := &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		tracer: tracer,
		logger: logger,
	}

	s.resourceHandler = httpadapter.New(s.newResourceMux())

	return s
}

// Configure applies the operator-tunable safety caps and returns s for fluent
// use after ProvideService. Any field left zero falls back to the built-in
// default, so standalone and external plugin builds (which have no
// [tsdb.graphite] config to pass) can skip it entirely.
func (s *Service) Configure(cfg Config) *Service {
	s.renderResponseMaxBytes = cfg.RenderResponseMaxBytes
	s.resourceResponseMaxBytes = cfg.ResourceResponseMaxBytes
	s.resourceRequestMaxBytes = cfg.ResourceRequestMaxBytes
	return s
}

// renderResponseCap returns the active /render response body cap. A zero
// field value (no ini override, or test fixture that leaves it unset) falls
// back to defaultRenderResponseMaxBytes.
func (s *Service) renderResponseCap() int64 {
	if s.renderResponseMaxBytes > 0 {
		return s.renderResponseMaxBytes
	}
	return defaultRenderResponseMaxBytes
}

// resourceResponseCap returns the active resource-call response body cap.
func (s *Service) resourceResponseCap() int64 {
	if s.resourceResponseMaxBytes > 0 {
		return s.resourceResponseMaxBytes
	}
	return defaultResourceResponseMaxBytes
}

// resourceRequestCap returns the active inbound resource-handler request
// body cap.
func (s *Service) resourceRequestCap() int64 {
	if s.resourceRequestMaxBytes > 0 {
		return s.resourceRequestMaxBytes
	}
	return defaultResourceRequestMaxBytes
}

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
	Id         int64
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		model := datasourceInfo{
			HTTPClient: client,
			URL:        settings.URL,
			Id:         settings.ID,
		}

		return model, nil
	}
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(datasourceInfo)
	return &instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	// get datasource info from context
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	return s.RunQuery(ctx, req, dsInfo)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}

func (s *Service) createRequest(ctx context.Context, dsInfo *datasourceInfo, params URLParams) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}

	if params.SubPath != "" {
		u.Path = path.Join(u.Path, params.SubPath)
	}

	if params.QueryParams != nil {
		queryValues := u.Query()
		for key, values := range params.QueryParams {
			for _, value := range values {
				queryValues.Add(key, value)
			}
		}
		u.RawQuery = queryValues.Encode()
	}

	method := params.Method
	if method == "" {
		method = http.MethodGet
	}

	req, err := http.NewRequestWithContext(ctx, method, u.String(), params.Body)
	if err != nil {
		s.logger.Info("Failed to create request", "error", err)
		return nil, backend.PluginError(fmt.Errorf("failed to create request: %w", err))
	}

	for k, v := range params.Headers {
		req.Header.Add(k, v)
	}

	return req, err
}
