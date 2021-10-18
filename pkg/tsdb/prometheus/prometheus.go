package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// Internal interval and range variables
const (
	varInterval     = "$__interval"
	varIntervalMs   = "$__interval_ms"
	varRange        = "$__range"
	varRangeS       = "$__range_s"
	varRangeMs      = "$__range_ms"
	varRateInterval = "$__rate_interval"
)

var (
	plog         = log.New("tsdb.prometheus")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	safeRes      = 11000
)

type Service struct {
	intervalCalculator intervalv2.Calculator
	im                 instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider, backendPluginManager backendplugin.Manager) (*Service, error) {
	plog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings(httpClientProvider))

	s := &Service{
		intervalCalculator: intervalv2.NewCalculator(),
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

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		// Set SigV4 service namespace
		if httpCliOpts.SigV4 != nil {
			httpCliOpts.SigV4.Service = "aps"
		}

		// timeInterval can be a string or can be missing.
		// if it is missing, we set it to empty-string
		timeInterval := ""

		timeIntervalJson := jsonData["timeInterval"]
		if timeIntervalJson != nil {
			// if it is not nil, it must be a string
			var ok bool
			timeInterval, ok = timeIntervalJson.(string)
			if !ok {
				return nil, errors.New("invalid time-interval provided")
			}
		}

		client, err := createClient(settings.URL, httpCliOpts, httpClientProvider)
		if err != nil {
			return nil, err
		}

		mdl := DatasourceInfo{
			ID:           settings.ID,
			URL:          settings.URL,
			TimeInterval: timeInterval,
			promClient:   client,
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

	client := dsInfo.promClient

	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	queries, err := s.parseQuery(req, dsInfo)
	if err != nil {
		return &result, err
	}

	for _, query := range queries {
		plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)

		span, ctx := opentracing.StartSpanFromContext(ctx, "datasource.prometheus")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		response := make(map[PrometheusQueryType]interface{})

		timeRange := apiv1.Range{
			Step: query.Step,
			// Align query range to step. It rounds start and end down to a multiple of step.
			Start: time.Unix(int64(math.Floor((float64(query.Start.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
			End:   time.Unix(int64(math.Floor((float64(query.End.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
		}

		if query.RangeQuery {
			rangeResponse, _, err := client.QueryRange(ctx, query.Expr, timeRange)
			if err != nil {
				return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
			}
			response[RangeQueryType] = rangeResponse
		}

		if query.InstantQuery {
			instantResponse, _, err := client.Query(ctx, query.Expr, query.End)
			if err != nil {
				return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
			}
			response[InstantQueryType] = instantResponse
		}
		// For now, we ignore exemplar errors and continue with processing of other results
		if query.ExemplarQuery {
			exemplarResponse, err := client.QueryExemplars(ctx, query.Expr, timeRange.Start, timeRange.End)
			if err != nil {
				exemplarResponse = nil
				plog.Error("Exemplar query", query.Expr, "failed with", err)
			}
			response[ExemplarQueryType] = exemplarResponse
		}

		frames, err := parseResponse(response, query)
		if err != nil {
			return &result, err
		}

		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frames,
		}
	}

	return &result, nil
}

func createClient(url string, httpOpts sdkhttpclient.Options, clientProvider httpclient.Provider) (apiv1.API, error) {
	customMiddlewares := customQueryParametersMiddleware(plog)
	httpOpts.Middlewares = []sdkhttpclient.Middleware{customMiddlewares}

	roundTripper, err := clientProvider.GetTransport(httpOpts)
	if err != nil {
		return nil, err
	}

	cfg := api.Config{
		Address:      url,
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
