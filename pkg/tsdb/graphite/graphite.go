package graphite

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/opentracing/opentracing-go"
)

const (
	dsName = "grafana-graphite-datasource"
)

var (
	glog = log.New("tsdb.graphite")
)

type graphiteExecutor struct {
	httpClientProvider httpclient.Provider
	logsService        log.Logger
	im                 instancemgmt.InstanceManager
	cfg                *setting.Cfg
}

type GraphiteService struct {
	logger               log.Logger
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	HTTPClientProvider   httpclient.Provider   `inject:""`
}

type datasourceInfo struct {
	HTTPClient              *http.Client
	URL                     string
	JSONData                map[string]interface{}
	DecryptedSecureJSONData map[string]string
	BasicAuthEnabled        bool
	BasicAuthUser           string
	Id                      int64
}

func NewInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		jsonData := map[string]interface{}{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		model := datasourceInfo{
			BasicAuthEnabled:        settings.BasicAuthEnabled,
			HTTPClient:              client,
			URL:                     settings.URL,
			JSONData:                jsonData,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			BasicAuthUser:           settings.BasicAuthUser,
			Id:                      settings.ID,
		}

		return model, nil
	}
}

func (s *GraphiteService) Init() error {
	im := datasource.NewInstanceManager(NewInstanceSettings(s.HTTPClientProvider))
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(im, s.logger, s.HTTPClientProvider, s.Cfg),
	})

	if err := s.BackendPluginManager.Register(dsName, factory); err != nil {
		glog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

func newExecutor(im instancemgmt.InstanceManager, logger log.Logger, httpC httpclient.Provider, cfg *setting.Cfg) *graphiteExecutor {
	return &graphiteExecutor{
		logsService:        logger,
		im:                 im,
		cfg:                cfg,
		httpClientProvider: httpC,
	}
}

func (e *graphiteExecutor) getDSInfo(pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := e.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(datasourceInfo)
	return &instance, nil
}

func (e *graphiteExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// get datasource info from context
	dsInfo, err := e.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	// take the first query in the request list?
	q := req.Queries[0]

	/*
		graphite doc about from and until, with sdk we are getting absolute time
		https://graphite-api.readthedocs.io/en/latest/api.html#from-until
		In legacy code, we have to convert string to time.Time, so a lot extra operation, there is no need anymore
	*/
	from := fmt.Sprintf("%02d:%02d_%02d%02d%02d", q.TimeRange.From.Hour(), q.TimeRange.From.Minute(),
		q.TimeRange.From.Year(), q.TimeRange.From.Month(), q.TimeRange.From.Day())
	until := fmt.Sprintf("%02d:%02d_%02d%02d%02d", q.TimeRange.To.Hour(), q.TimeRange.To.Minute(),
		q.TimeRange.To.Year(), q.TimeRange.To.Month(), q.TimeRange.To.Day())

	var target string

	formData := url.Values{
		"from":          []string{from},
		"until":         []string{until},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	// Calculate target of Graphite Request
	emptyQueries := make([]string, 0)
	for _, query := range req.Queries {
		model, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return nil, err
		}
		glog.Debug("graphite", "query", model)
		currTarget := ""
		if fullTarget, err := model.Get("targetFull").String(); err == nil {
			currTarget = fullTarget
		} else {
			currTarget = model.Get("target").MustString()
		}
		if currTarget == "" {
			glog.Debug("graphite", "empty query target", model)
			emptyQueries = append(emptyQueries, fmt.Sprintf("Query: %v has no target", model))
			continue
		}
		target = fixIntervalFormat(currTarget)
	}

	var result *backend.QueryDataResponse

	if target == "" {
		glog.Error("No targets in query model", "models without targets", strings.Join(emptyQueries, "\n"))
		return result, errors.New("no query target found for the alert rule")
	}

	formData["target"] = []string{target}

	if setting.Env == setting.Dev {
		glog.Debug("Graphite request", "params", formData)
	}

	graphiteReq, err := e.createRequest(dsInfo, formData)
	if err != nil {
		return result, err
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "graphite query")
	span.SetTag("target", target)
	span.SetTag("from", from)
	span.SetTag("until", until)
	span.SetTag("datasource_id", dsInfo.Id)
	span.SetTag("org_id", req.PluginContext.OrgID)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(graphiteReq.Header)); err != nil {
		return result, err
	}

	res, err := ctxhttp.Do(ctx, dsInfo.HTTPClient, graphiteReq)
	if err != nil {
		return result, err
	}

	data, err := e.parseResponse(res)
	if err != nil {
		return result, err
	}

	resp := backend.NewQueryDataResponse()

	frames := convertResponseToDataframes(data)
	respD := resp.Responses["A"]
	respD.Frames = frames
	resp.Responses["A"] = respD

	return result, nil
}

func convertResponseToDataframes(resp []TargetResponseDTO) []*data.Frame {
	var frames []*data.Frame
	for _, series := range resp {
		timeVector := make([]time.Time, 0, len(series.DataPoints))
		values := make([]float64, 0, len(series.DataPoints))

		for _, k := range series.DataPoints {
			timeVector = append(timeVector, time.Unix(int64(k[0].Float64), 0).UTC())
			values = append(values, k[1].Float64)
		}
		frames = append(frames, data.NewFrame(series.Target,
			data.NewField("time", nil, timeVector),
			data.NewField("value", nil, values)))

		if setting.Env == setting.Dev {
			glog.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
		}
	}
	return frames
}

func (e *graphiteExecutor) parseResponse(res *http.Response) ([]TargetResponseDTO, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			glog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		glog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("request failed, status: %s", res.Status)
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	for si := range data {
		// Convert Response to timestamps MS
		for pi, point := range data[si].DataPoints {
			data[si].DataPoints[pi][1].Float64 = point[1].Float64 * 1000
		}
	}
	return data, nil
}

func (e *graphiteExecutor) createRequest(dsInfo *datasourceInfo, data url.Values) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(data.Encode()))
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if dsInfo.BasicAuthEnabled {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedSecureJSONData["basicAuthPassword"])
	}

	return req, err
}

func fixIntervalFormat(target string) string {
	rMinute := regexp.MustCompile(`'(\d+)m'`)
	target = rMinute.ReplaceAllStringFunc(target, func(m string) string {
		return strings.ReplaceAll(m, "m", "min")
	})
	rMonth := regexp.MustCompile(`'(\d+)M'`)
	target = rMonth.ReplaceAllStringFunc(target, func(M string) string {
		return strings.ReplaceAll(M, "M", "mon")
	})
	return target
}
