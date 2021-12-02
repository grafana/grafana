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
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"

	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

type Service struct {
	im   instancemgmt.InstanceManager
	plog log.Logger
}

func ProvideService(httpClientProvider httpclient.Provider, registrar plugins.CoreBackendRegistrar) (*Service, error) {
	im := datasource.NewInstanceManager(newInstanceSettings(httpClientProvider))
	s := &Service{
		im:   im,
		plog: log.New("tsdb.loki"),
	}

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	if err := registrar.LoadAndRegister("loki", factory); err != nil {
		s.plog.Error("Failed to register plugin", "error", err)
		return nil, err
	}

	return s, nil
}

var (
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

	queries, err := parseQuery(dsInfo, req)
	if err != nil {
		return result, err
	}

	for _, query := range queries {
		s.plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)
		span, _ := opentracing.StartSpanFromContext(ctx, "alerting.loki")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		// `limit` only applies to log-producing queries, and we
		// currently only support metric queries, so this can be set to any value.
		limit := 1

		// we do not use `interval`, so we set it to zero
		interval := time.Duration(0)

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
