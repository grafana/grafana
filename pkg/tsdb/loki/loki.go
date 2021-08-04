package loki

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

type LokiExecutor struct {
	intervalCalculator interval.Calculator
	httpClientProvider httpclient.Provider
}

// nolint:staticcheck // plugins.DataPlugin deprecated
func New(httpClientProvider httpclient.Provider) func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
	// nolint:staticcheck // plugins.DataPlugin deprecated
	return func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
		return &LokiExecutor{
			intervalCalculator: interval.NewCalculator(interval.CalculatorOptions{MinInterval: time.Second * 1}),
			httpClientProvider: httpClientProvider,
		}, nil
	}
}

var (
	plog         = log.New("tsdb.loki")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

// DataQuery executes a Loki query.
//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *LokiExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{},
	}

	tlsConfig, err := dsInfo.GetTLSConfig(e.httpClientProvider)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	transport, err := dsInfo.GetHTTPTransport(e.httpClientProvider)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	client := &client.DefaultClient{
		Address:  dsInfo.Url,
		Username: dsInfo.BasicAuthUser,
		Password: dsInfo.DecryptedBasicAuthPassword(),
		TLSConfig: config.TLSConfig{
			InsecureSkipVerify: tlsConfig.InsecureSkipVerify,
		},
		Tripperware: func(t http.RoundTripper) http.RoundTripper {
			return transport
		},
	}

	queries, err := e.parseQuery(dsInfo, queryContext)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	for _, query := range queries {
		plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)
		span, _ := opentracing.StartSpanFromContext(ctx, "alerting.loki")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		//Currently hard coded as not used - applies to log queries
		limit := 1000
		//Currently hard coded as not used - applies to queries which produce a stream response
		interval := time.Second * 1

		value, err := client.QueryRange(query.Expr, limit, query.Start, query.End, logproto.BACKWARD, query.Step, interval, false)
		if err != nil {
			return plugins.DataResponse{}, err
		}

		queryResult, err := parseResponse(value, query)
		if err != nil {
			return plugins.DataResponse{}, err
		}
		result.Results[query.RefID] = queryResult
	}

	return result, nil
}

//If legend (using of name or pattern instead of time series name) is used, use that name/pattern for formatting
func formatLegend(metric model.Metric, query *lokiQuery) string {
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

func (e *LokiExecutor) parseQuery(dsInfo *models.DataSource, queryContext plugins.DataQuery) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, queryModel := range queryContext.Queries {
		expr, err := queryModel.Model.Get("expr").String()
		if err != nil {
			return nil, fmt.Errorf("failed to parse Expr: %v", err)
		}

		format := queryModel.Model.Get("legendFormat").MustString("")

		start, err := queryContext.TimeRange.ParseFrom()
		if err != nil {
			return nil, fmt.Errorf("failed to parse From: %v", err)
		}

		end, err := queryContext.TimeRange.ParseTo()
		if err != nil {
			return nil, fmt.Errorf("failed to parse To: %v", err)
		}

		dsInterval, err := interval.GetIntervalFrom(dsInfo, queryModel.Model, time.Second)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Interval: %v", err)
		}

		interval, err := e.intervalCalculator.Calculate(*queryContext.TimeRange, dsInterval, "min")
		if err != nil {
			return nil, err
		}
		step := time.Duration(int64(interval.Value))

		qs = append(qs, &lokiQuery{
			Expr:         expr,
			Step:         step,
			LegendFormat: format,
			Start:        start,
			End:          end,
			RefID:        queryModel.RefID,
		})
	}

	return qs, nil
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func parseResponse(value *loghttp.QueryResponse, query *lokiQuery) (plugins.DataQueryResult, error) {
	var queryRes plugins.DataQueryResult
	frames := data.Frames{}

	//We are currently processing only matrix results (for alerting)
	matrix, ok := value.Data.Result.(loghttp.Matrix)
	if !ok {
		return queryRes, fmt.Errorf("unsupported result format: %q", value.Data.ResultType)
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
