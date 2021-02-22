package prometheus

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"

	"net/http"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

type PrometheusExecutor struct {
	Transport http.RoundTripper

	intervalCalculator interval.Calculator
}

type basicAuthTransport struct {
	Transport http.RoundTripper

	username string
	password string
}

func (bat basicAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.SetBasicAuth(bat.username, bat.password)
	return bat.Transport.RoundTrip(req)
}

func NewExecutor(dsInfo *models.DataSource) (pluginmodels.TSDBPlugin, error) {
	transport, err := dsInfo.GetHttpTransport()
	if err != nil {
		return nil, err
	}

	return &PrometheusExecutor{
		Transport:          transport,
		intervalCalculator: interval.NewCalculator(interval.CalculatorOptions{MinInterval: time.Second * 1}),
	}, nil
}

var (
	plog         log.Logger
	legendFormat *regexp.Regexp = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

func init() {
	plog = log.New("tsdb.prometheus")
}

func (e *PrometheusExecutor) getClient(dsInfo *models.DataSource) (apiv1.API, error) {
	cfg := api.Config{
		Address:      dsInfo.Url,
		RoundTripper: e.Transport,
	}

	if dsInfo.BasicAuth {
		cfg.RoundTripper = basicAuthTransport{
			Transport: e.Transport,
			username:  dsInfo.BasicAuthUser,
			password:  dsInfo.DecryptedBasicAuthPassword(),
		}
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (e *PrometheusExecutor) TSDBQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery pluginmodels.TSDBQuery) (pluginmodels.TSDBResponse, error) {
	result := pluginmodels.TSDBResponse{
		Results: map[string]pluginmodels.TSDBQueryResult{},
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

func (e *PrometheusExecutor) parseQuery(dsInfo *models.DataSource, query pluginmodels.TSDBQuery) (
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

func parseResponse(value model.Value, query *PrometheusQuery) (pluginmodels.TSDBQueryResult, error) {
	var queryRes pluginmodels.TSDBQueryResult

	data, ok := value.(model.Matrix)
	if !ok {
		return queryRes, fmt.Errorf("unsupported result format: %q", value.Type().String())
	}

	for _, v := range data {
		series := pluginmodels.TSDBTimeSeries{
			Name:   formatLegend(v.Metric, query),
			Tags:   make(map[string]string, len(v.Metric)),
			Points: make([]pluginmodels.TSDBTimePoint, 0, len(v.Values)),
		}

		for k, v := range v.Metric {
			series.Tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			series.Points = append(series.Points, pluginmodels.TSDBTimePoint{
				null.FloatFrom(float64(k.Value)),
				null.FloatFrom(float64(k.Timestamp.Unix() * 1000)),
			})
		}

		queryRes.Series = append(queryRes.Series, series)
	}

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
