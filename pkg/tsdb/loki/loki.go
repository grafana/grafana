package loki

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/loki/pkg/loghttp"
	"go.opentelemetry.io/otel/attribute"

	"github.com/prometheus/common/model"
)

type Service struct {
	im     instancemgmt.InstanceManager
	plog   log.Logger
	tracer tracing.Tracer
}

func ProvideService(httpClientProvider httpclient.Provider, tracer tracing.Tracer) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		plog:   log.New("tsdb.loki"),
		tracer: tracer,
	}
}

var (
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
}

type QueryModel struct {
	QueryType    string `json:"queryType"`
	Expr         string `json:"expr"`
	LegendFormat string `json:"legendFormat"`
	Interval     string `json:"interval"`
	IntervalMS   int    `json:"intervalMS"`
	Resolution   int64  `json:"resolution"`
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		model := &datasourceInfo{
			HTTPClient: client,
			URL:        settings.URL,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return result, err
	}

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, s.plog)

	queries, err := parseQuery(req)
	if err != nil {
		return result, err
	}

	for _, query := range queries {
		s.plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)
		_, span := s.tracer.Start(ctx, "alerting.loki")
		span.SetAttributes("expr", query.Expr, attribute.Key("expr").String(query.Expr))
		span.SetAttributes("start_unixnano", query.Start, attribute.Key("start_unixnano").Int64(query.Start.UnixNano()))
		span.SetAttributes("stop_unixnano", query.End, attribute.Key("stop_unixnano").Int64(query.End.UnixNano()))
		defer span.End()

		frames, err := runQuery(ctx, api, query)

		queryRes := backend.DataResponse{}

		if err != nil {
			queryRes.Error = err
		} else {
			queryRes.Frames = frames
		}

		result.Responses[query.RefID] = queryRes
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

func parseResponse(value *loghttp.QueryResponse, query *lokiQuery) (data.Frames, error) {
	frames := data.Frames{}

	//We are currently processing only matrix results (for alerting)
	matrix, ok := value.Data.Result.(loghttp.Matrix)
	if !ok {
		return frames, fmt.Errorf("unsupported result format: %q", value.Data.ResultType)
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
			timeVector = append(timeVector, k.Timestamp.Time().UTC())
			values = append(values, float64(k.Value))
		}

		timeField := data.NewField("time", nil, timeVector)
		timeField.Config = &data.FieldConfig{Interval: float64(query.Step.Milliseconds())}
		valueField := data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})

		frame := data.NewFrame(name, timeField, valueField)
		frame.SetMeta(&data.FrameMeta{
			ExecutedQueryString: "Expr: " + query.Expr + "\n" + "Step: " + query.Step.String(),
		})

		frames = append(frames, frame)
	}

	return frames, nil
}

// we extracted this part of the functionality to make it easy to unit-test it
func runQuery(ctx context.Context, api *LokiAPI, query *lokiQuery) (data.Frames, error) {
	value, err := api.QueryRange(ctx, *query)
	if err != nil {
		return data.Frames{}, err
	}

	return parseResponse(value, query)
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
