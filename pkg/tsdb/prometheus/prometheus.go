package prometheus

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"

	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

type PrometheusExecutor struct {
	baseRoundTripperFactory func(dsInfo *models.DataSource) (http.RoundTripper, error)
	intervalCalculator      interval.Calculator
}

type prometheusTransport struct {
	Transport http.RoundTripper

	hasBasicAuth bool
	username     string
	password     string

	customQueryParameters string
}

func (transport *prometheusTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if transport.hasBasicAuth {
		req.SetBasicAuth(transport.username, transport.password)
	}

	if transport.customQueryParameters != "" {
		params := url.Values{}
		for _, param := range strings.Split(transport.customQueryParameters, "&") {
			parts := strings.Split(param, "=")
			if len(parts) == 1 {
				// This is probably a mistake on the users part in defining the params but we don't want to crash.
				params.Add(parts[0], "")
			} else {
				params.Add(parts[0], parts[1])
			}
		}
		if req.URL.RawQuery != "" {
			req.URL.RawQuery = fmt.Sprintf("%s&%s", req.URL.RawQuery, params.Encode())
		} else {
			req.URL.RawQuery = params.Encode()
		}
	}

	return transport.Transport.RoundTrip(req)
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func New(provider httpclient.Provider) func(*models.DataSource) (plugins.DataPlugin, error) {
	return func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
		transport, err := dsInfo.GetHTTPTransport(provider)
		if err != nil {
			return nil, err
		}

		return &PrometheusExecutor{
			intervalCalculator: interval.NewCalculator(interval.CalculatorOptions{MinInterval: time.Second * 1}),
			baseRoundTripperFactory: func(ds *models.DataSource) (http.RoundTripper, error) {
				return transport, nil
			},
		}, nil
	}
}

var (
	plog         log.Logger
	legendFormat *regexp.Regexp = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

func init() {
	plog = log.New("tsdb.prometheus")
}

func (e *PrometheusExecutor) getClient(dsInfo *models.DataSource) (apiv1.API, error) {
	// Would make sense to cache this but executor is recreated on every alert request anyway.
	transport, err := e.baseRoundTripperFactory(dsInfo)
	if err != nil {
		return nil, err
	}

	promTransport := &prometheusTransport{
		Transport:             transport,
		hasBasicAuth:          dsInfo.BasicAuth,
		username:              dsInfo.BasicAuthUser,
		password:              dsInfo.DecryptedBasicAuthPassword(),
		customQueryParameters: dsInfo.JsonData.Get("customQueryParameters").MustString(""),
	}

	cfg := api.Config{
		Address:      dsInfo.Url,
		RoundTripper: promTransport,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

//nolint: staticcheck // plugins.DataResponse deprecated
func (e *PrometheusExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery plugins.DataQuery) (plugins.DataResponse, error) {
	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{},
	}

	client, err := e.getClient(dsInfo)
	if err != nil {
		return result, err
	}

	queries, err := e.parseQuery(dsInfo, tsdbQuery)
	if err != nil {
		return result, err
	}

	for _, query := range queries {
		timeRange := apiv1.Range{
			Start: query.Start,
			End:   query.End,
			Step:  query.Step,
		}

		plog.Debug("Sending query", "start", timeRange.Start, "end", timeRange.End, "step", timeRange.Step, "query", query.Expr)

		span, ctx := opentracing.StartSpanFromContext(ctx, "alerting.prometheus")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		value, _, err := client.QueryRange(ctx, query.Expr, timeRange)

		if err != nil {
			return result, err
		}

		queryResult, err := parseResponse(value, query)
		if err != nil {
			return result, err
		}
		result.Results[query.RefId] = queryResult
	}

	return result, nil
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

func (e *PrometheusExecutor) parseQuery(dsInfo *models.DataSource, query plugins.DataQuery) (
	[]*PrometheusQuery, error) {
	qs := []*PrometheusQuery{}
	for _, queryModel := range query.Queries {
		expr, err := queryModel.Model.Get("expr").String()
		if err != nil {
			return nil, err
		}

		format := queryModel.Model.Get("legendFormat").MustString("")

		start, err := query.TimeRange.ParseFrom()
		if err != nil {
			return nil, err
		}

		end, err := query.TimeRange.ParseTo()
		if err != nil {
			return nil, err
		}

		dsInterval, err := interval.GetIntervalFrom(dsInfo, queryModel.Model, time.Second*15)
		if err != nil {
			return nil, err
		}

		intervalFactor := queryModel.Model.Get("intervalFactor").MustInt64(1)
		interval := e.intervalCalculator.Calculate(*query.TimeRange, dsInterval)
		step := time.Duration(int64(interval.Value) * intervalFactor)

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

//nolint: staticcheck // plugins.DataQueryResult deprecated
func parseResponse(value model.Value, query *PrometheusQuery) (plugins.DataQueryResult, error) {
	var queryRes plugins.DataQueryResult
	frames := data.Frames{}

	matrix, ok := value.(model.Matrix)
	if !ok {
		return queryRes, fmt.Errorf("unsupported result format: %q", value.Type().String())
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
	queryRes.Dataframes = plugins.NewDecodedDataFrames(frames)

	return queryRes, nil
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
