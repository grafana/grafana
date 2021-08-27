package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

var (
	plog         = log.New("tsdb.prometheus")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	safeRes      = 11000
)

type DatasourceInfo struct {
	ID             int64
	HTTPClientOpts sdkhttpclient.Options
	URL            string
	HTTPMethod     string
	TimeInterval   string
}

type Service struct {
	httpClientProvider httpclient.Provider
	intervalCalculator tsdb.Calculator
	im                 instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider, backendPluginManager backendplugin.Manager) (*Service, error) {
	plog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings())

	s := &Service{
		httpClientProvider: httpClientProvider,
		intervalCalculator: tsdb.NewCalculator(),
		im:                 im,
	}

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})
	if err := backendPluginManager.Register("prometheus", factory); err != nil {
		plog.Error("Failed to register plugin", "error", err)
		return nil, err
	}

	return s, nil
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		defaultHttpMethod := http.MethodPost
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		httpMethod, ok := jsonData["httpMethod"].(string)
		if !ok {
			httpMethod = defaultHttpMethod
		}

		// timeInterval can be a string or can be missing.
		// if it is missing, we set it to empty-string

		timeInterval := ""

		timeIntervalJson := jsonData["timeInterval"]
		if timeIntervalJson != nil {
			// if it is not nil, it must be a string
			timeInterval, ok = timeIntervalJson.(string)
			if !ok {
				return nil, errors.New("invalid time-interval provided")
			}
		}

		mdl := DatasourceInfo{
			ID:             settings.ID,
			URL:            settings.URL,
			HTTPClientOpts: httpCliOpts,
			HTTPMethod:     httpMethod,
			TimeInterval:   timeInterval,
		}
		return mdl, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}
	client, err := getClient(dsInfo, s)
	if err != nil {
		return nil, err
	}

	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	// Create queries
	queries, err := s.parseQuery(dsInfo, req)
	if err != nil {
		return &result, err
	}

	for _, query := range queries {
		timeRange := apiv1.Range{
			Start: query.Start,
			End:   query.End,
			Step:  query.Step,
		}

		plog.Debug("Sending query", "start", timeRange.Start, "end", timeRange.End, "step", timeRange.Step, "query", query.Expr)
		span, ctx := opentracing.StartSpanFromContext(ctx, "datasource.prometheus")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		var results model.Value

		switch query.QueryType {
		case Instant:
			results, _, err = client.Query(ctx, query.Expr, query.End)
			if err != nil {
				return &result, fmt.Errorf("error: %v, for query: %s", err, query.Expr)
			}
		case Range:
			results, _, err = client.QueryRange(ctx, query.Expr, timeRange)
			if err != nil {
				return &result, fmt.Errorf("error: %v, for query: %s", err, query.Expr)
			}
		}

		// Parse response to dataFrames
		frames, err := parseResponse(results, query)
		if err != nil {
			return &result, err
		}
		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frames,
		}
	}

	return &result, nil
}

func getClient(dsInfo *DatasourceInfo, s *Service) (apiv1.API, error) {
	opts := &sdkhttpclient.Options{
		Timeouts:  dsInfo.HTTPClientOpts.Timeouts,
		TLS:       dsInfo.HTTPClientOpts.TLS,
		BasicAuth: dsInfo.HTTPClientOpts.BasicAuth,
	}

	customMiddlewares := customQueryParametersMiddleware(plog)
	opts.Middlewares = []sdkhttpclient.Middleware{customMiddlewares}

	roundTripper, err := s.httpClientProvider.GetTransport(*opts)
	if err != nil {
		return nil, err
	}

	cfg := api.Config{
		Address:      dsInfo.URL,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(DatasourceInfo)

	return &instance, nil
}

// IsAPIError returns whether err is or wraps a Prometheus error.
func IsAPIError(err error) bool {
	// Check if the right error type is in err's chain.
	var e *apiv1.Error
	return errors.As(err, &e)
}

func ConvertAPIError(err error) error {
	var e *apiv1.Error
	if errors.As(err, &e) {
		return fmt.Errorf("%s: %s", e.Msg, e.Detail)
	}
	return err
}
