package loki

import (
	"context"
	"crypto/tls"
	"encoding/json"
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
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"

	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

type Service struct {
	intervalCalculator tsdb.Calculator
	im                 instancemgmt.InstanceManager

	HTTPClientProvider   httpclient.Provider   `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
}

var (
	plog         = log.New("tsdb.loki")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

type datasourceInfo struct {
	HTTPClient        *http.Client
	URL               string
	TLSClientConfig   *tls.Config
	BasicAuthUser     string
	BasicAuthPassword string
	TimeInterval      string `json:"timeInterval"`
}

type ResponseModel struct {
	Expr         string `json:"expr"`
	LegendFormat string `json:"legendFormat"`
	Interval     string `json:"interval"`
	IntervalMS   int    `json:"intervalMS"`
	Resolution   int64  `json:"resolution"`
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "LokiService",
		InitPriority: registry.Low,
		Instance:     &Service{},
	})
}

func (s *Service) Init() error {
	s.im = datasource.NewInstanceManager(newInstanceSettings(s.HTTPClientProvider))
	s.intervalCalculator = tsdb.NewCalculator()
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	if err := s.BackendPluginManager.RegisterAndStart(context.Background(), "loki", factory); err != nil {
		plog.Error("Failed to register plugin", "error", err)
	}

	return nil
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

		tlsClientConfig, err := httpClientProvider.GetTLSConfig(opts)
		if err != nil {
			return nil, err
		}

		jsonData := datasourceInfo{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		model := &datasourceInfo{
			HTTPClient:        client,
			URL:               settings.URL,
			TLSClientConfig:   tlsClientConfig,
			TimeInterval:      jsonData.TimeInterval,
			BasicAuthUser:     settings.BasicAuthUser,
			BasicAuthPassword: settings.DecryptedSecureJSONData["basicAuthPassword"],
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	queryRes := backend.DataResponse{}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return result, err
	}

	client := &client.DefaultClient{
		Address:  dsInfo.URL,
		Username: dsInfo.BasicAuthUser,
		Password: dsInfo.BasicAuthPassword,
		TLSConfig: config.TLSConfig{
			InsecureSkipVerify: dsInfo.TLSClientConfig.InsecureSkipVerify,
		},
		Tripperware: func(t http.RoundTripper) http.RoundTripper {
			return dsInfo.HTTPClient.Transport
		},
	}

	queries, err := s.parseQuery(dsInfo, req)
	if err != nil {
		return result, err
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
			return result, err
		}

		frames, err := parseResponse(value, query)
		if err != nil {
			return result, err
		}
		queryRes.Frames = frames
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

func (s *Service) parseQuery(dsInfo *datasourceInfo, queryContext *backend.QueryDataRequest) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, query := range queryContext.Queries {
		model := &ResponseModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		start := query.TimeRange.From
		end := query.TimeRange.To

		dsInterval, err := tsdb.GetIntervalFrom(dsInfo.TimeInterval, model.Interval, int64(model.IntervalMS), time.Second)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Interval: %v", err)
		}

		interval, err := s.intervalCalculator.Calculate(query.TimeRange, dsInterval, tsdb.Min)
		if err != nil {
			return nil, err
		}

		var resolution int64 = 1
		if model.Resolution >= 1 && model.Resolution <= 5 || model.Resolution == 10 {
			resolution = model.Resolution
		}

		step := time.Duration(int64(interval.Value) * resolution)

		qs = append(qs, &lokiQuery{
			Expr:         model.Expr,
			Step:         step,
			LegendFormat: model.LegendFormat,
			Start:        start,
			End:          end,
			RefID:        query.RefID,
		})
	}

	return qs, nil
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
			timeVector = append(timeVector, time.Unix(k.Timestamp.Unix(), 0).UTC())
			values = append(values, float64(k.Value))
		}

		frames = append(frames, data.NewFrame(name,
			data.NewField("time", nil, timeVector),
			data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames, nil
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
