package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
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

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PrometheusService",
		InitPriority: registry.Low,
		Instance:     &Service{},
	})
}

type Service struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	HTTPClientProvider   httpclient.Provider   `inject:""`
	intervalCalculator   tsdb.Calculator
	im                   instancemgmt.InstanceManager
}

func (s *Service) Init() error {
	plog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newService(im, s.HTTPClientProvider),
	})
	if err := s.BackendPluginManager.Register("prometheus", factory); err != nil {
		plog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
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

		httpMethod, ok := jsonData["httpMethod"].(string)
		if !ok {
			return nil, errors.New("no http method provided")
		}

		timeInterval, ok := jsonData["timeInterval"].(string)
		if !ok {
			return nil, errors.New("invalid time-interval provided")
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

// newService creates a new executor func.
func newService(im instancemgmt.InstanceManager, httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im:                 im,
		HTTPClientProvider: httpClientProvider,
		intervalCalculator: tsdb.NewCalculator(),
	}
}

//nolint: staticcheck // plugins.DataResponse deprecated
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

	queries, err := s.parseQuery(req.Queries, dsInfo)
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

		value, _, err := client.QueryRange(ctx, query.Expr, timeRange)

		if err != nil {
			return &result, err
		}

		frame, err := parseResponse(value, query)
		if err != nil {
			return &result, err
		}
		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frame,
		}
	}

	return &result, nil
}

func getClient(dsInfo *DatasourceInfo, s *Service) (apiv1.API, error) {
	opts := &sdkhttpclient.Options{
		Timeouts: dsInfo.HTTPClientOpts.Timeouts,
		TLS:      dsInfo.HTTPClientOpts.TLS,
	}

	customMiddlewares := customQueryParametersMiddleware(plog)
	opts.Middlewares = []sdkhttpclient.Middleware{customMiddlewares}

	roundTripper, err := s.HTTPClientProvider.GetTransport(*opts)
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

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	if query.LegendFormat == "" {
		return metric.String()
	}

	result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := metric[model.LabelName(labelName)]; exists {
			return []byte(val)
		}
		return []byte{}
	})

	return string(result)
}

// when DataQuery.Interval is zero, we have to manually calculate the interval-value
// this happens when old-alerting
func calculateMissingInterval(jsonModel *simplejson.Json, dsInfo *DatasourceInfo, timeRange backend.TimeRange) (time.Duration, error) {
	// NOTE: when old-alerting happens,
	// two values are stored in the same json-attribute,
	// so they overwrite each other:
	// - panel_query_options/min_interval
	// - query_editor/step_value
	// there is no way to find out what happened.
	// here we need panel_query_options/min_interval,
	// so we have to assume it is that one.
	panelMinInterval := jsonModel.Get("interval").MustString("")
	dataSourceMinInterval := dsInfo.TimeInterval

	minInterval, err := tsdb.GetIntervalFrom(dataSourceMinInterval, panelMinInterval, 0, 15*time.Second)
	if err != nil {
		return 0, err
	}

	calculator := tsdb.NewCalculator(tsdb.CalculatorOptions{})
	// NOTE: here we only use the `min` mode, it does not matter what is in the step-mode
	// setting. here we only want to calculate the interval using the minValue.
	calculatedInterval, err := calculator.Calculate(timeRange, minInterval, tsdb.Min)
	if err != nil {
		return 0, err
	}

	return calculatedInterval.Value, nil
}

// if step-value is specified, we use it to modify the interval-value,
// otherwise just return the original value
func adjustIntervalByStepIfExists(interval time.Duration, jsonModel *simplejson.Json) (time.Duration, error) {
	// NOTE: when old-alerting happens,
	// two values are stored in the same json-attribute,
	// so they overwrite each other:
	// - panel_query_options/min_interval
	// - query_editor/step_value
	// there is no way to find out what happened.
	// here we need query_editor/step_value
	// so we have to assume it is that one.
	stepValue := jsonModel.Get("interval").MustString("")
	hasStepValue := stepValue != ""

	// if no step-interval is specified, we keep the original interval-value
	if !hasStepValue {
		return interval, nil
	}

	stepMode := jsonModel.Get("stepMode").MustString("min")
	stepDuration, err := gtime.ParseDuration(stepValue)
	if err != nil {
		return 0, err
	}

	// FIXME: do we need to handle step-interval-values that look like `>4s` or `<5s`
	switch stepMode {
	case "min":
		if interval < stepDuration {
			interval = stepDuration
		}
	case "max":
		if interval > stepDuration {
			interval = stepDuration
		}
	case "exact":
		interval = stepDuration
	default:
		return 0, fmt.Errorf("unrecognized step-mode: %v", stepMode)
	}

	return interval, nil
}

func (s *Service) parseQuery(queries []backend.DataQuery, dsInfo *DatasourceInfo) (
	[]*PrometheusQuery, error) {

	qs := []*PrometheusQuery{}
	for _, queryModel := range queries {
		jsonModel, err := simplejson.NewJson(queryModel.JSON)
		if err != nil {
			return nil, err
		}
		expr, err := jsonModel.Get("expr").String()
		if err != nil {
			return nil, err
		}

		format := jsonModel.Get("legendFormat").MustString("")

		start := queryModel.TimeRange.From
		end := queryModel.TimeRange.To

		// this is the interval-value that is calculated
		// in a generic way for every datasource
		interval := queryModel.Interval

		// if interval is not available, we calculate it manually.
		// this happens when old-alerting
		if interval == time.Nanosecond*0 {
			interval, err = calculateMissingInterval(jsonModel, dsInfo, queryModel.TimeRange)
			if err != nil {
				return nil, err
			}
		}

		// we adjust the interval by the step-value, if it was specified
		interval, err = adjustIntervalByStepIfExists(interval, jsonModel)
		if err != nil {
			return nil, err
		}

		// we make sure the interval-value is not lower than the safe-interval
		safeInterval := s.intervalCalculator.CalculateSafeInterval(queries[0].TimeRange, int64(safeRes))

		if interval < safeInterval.Value {
			interval = safeInterval.Value
		}

		// we multiply interval by intervalFactor to get the prometheus-step-attribute
		intervalFactor := jsonModel.Get("intervalFactor").MustInt64(1)
		step := time.Duration(int64(interval) * intervalFactor)

		qs = append(qs, &PrometheusQuery{
			Expr:         expr,
			Step:         step,
			LegendFormat: format,
			Start:        start,
			End:          end,
			RefId:        queryModel.RefID,
		})
	}

	return qs, nil
}

func parseResponse(value model.Value, query *PrometheusQuery) (data.Frames, error) {
	frames := data.Frames{}

	matrix, ok := value.(model.Matrix)
	if !ok {
		return frames, fmt.Errorf("unsupported result format: %q", value.Type().String())
	}

	for _, v := range matrix {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, len(v.Values))
		values := make([]float64, 0, len(v.Values))

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			timeVector = append(timeVector, time.Unix(k.Timestamp.Unix(), 0).UTC())
			values = append(values, float64(k.Value))
		}
		frames = append(frames, data.NewFrame(name,
			data.NewField("time", nil, timeVector),
			data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames, nil
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
