package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
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
	q := req.Queries[0]
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	switch q.QueryType {
	default:
		return s.executeTimeSeriesQuery(ctx, req, dsInfo)
	}
}

// switch TYPE {
// 	// We have everything
// 	case "labelNames":
// 		labelNamesResponse, _,  err := client.LabelNames(ctx, []string{}, timeRange.Start, timeRange.End)
// 		if err != nil {
// 			return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
// 		}
// 		response["labelNames"] = labelNamesResponse
// 	// We miss label
// 	case "LabelValues":
// 		labelValuesResponse, _,  err := client.LabelValues(ctx, "", []string{}, timeRange.Start, timeRange.End)
// 		if err != nil {
// 			return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
// 		}
// 		response["LabelValues"] = labelValuesResponse
// 	// We miss matchers - metric
// 	case "series"
// 		seriesResponse, _,  err := client.Series(ctx, []string{}, timeRange.Start, timeRange.End)
// 		if err != nil {
// 			return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
// 		}
// 		response["LabelValues"] = labelValuesResponse

// 	default:

// }

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

func deviation(values []float64) float64 {
	var sum, mean, sd float64
	valuesLen := float64(len(values))
	for _, value := range values {
		sum += value
	}
	mean = sum / valuesLen
	for j := 0; j < len(values); j++ {
		sd += math.Pow(values[j]-mean, 2)
	}
	return math.Sqrt(sd / (valuesLen - 1))
}
