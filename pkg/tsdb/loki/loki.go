package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var logger = log.New("tsdb.loki")

type Service struct {
	im       instancemgmt.InstanceManager
	features featuremgmt.FeatureToggles
	tracer   tracing.Tracer
}

var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.StreamHandler       = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
)

func ProvideService(httpClientProvider httpclient.Provider, features featuremgmt.FeatureToggles, tracer tracing.Tracer) *Service {
	return &Service{
		im:       datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		features: features,
		tracer:   tracer,
	}
}

var (
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string

	// open streams
	streams   map[string]data.FrameJSONCache
	streamsMu sync.RWMutex
}

type QueryJSONModel struct {
	QueryType    string `json:"queryType"`
	Expr         string `json:"expr"`
	Direction    string `json:"direction"`
	LegendFormat string `json:"legendFormat"`
	Interval     string `json:"interval"`
	IntervalMS   int    `json:"intervalMS"`
	Resolution   int64  `json:"resolution"`
	MaxLines     int    `json:"maxLines"`
	VolumeQuery  bool   `json:"volumeQuery"`
}

func parseQueryModel(raw json.RawMessage) (*QueryJSONModel, error) {
	model := &QueryJSONModel{}
	err := json.Unmarshal(raw, model)
	return model, err
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
			streams:    make(map[string]data.FrameJSONCache),
		}
		return model, nil
	}
}

// in the CallResource API, request-headers are in a map where the value is an array-of-strings,
// so we need a helper function that can extract a single string-value from an array-of-strings.
// i only deal with two cases:
// - zero-length array
// - first-item of the array
// i do not handle the case where there are multiple items in the array, i do not know
// if that can even happen ever, for the headers that we are interested in.
func arrayHeaderFirstValue(values []string) string {
	if len(values) == 0 {
		return ""
	}

	// NOTE: we assume there never is a second item in the http-header-values-array
	return values[0]
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return err
	}
	return callResource(ctx, req, sender, dsInfo, logger.FromContext(ctx))
}

func getHeadersForCallResource(headers map[string][]string) map[string]string {
	data := make(map[string]string)

	if auth := arrayHeaderFirstValue(headers["Authorization"]); auth != "" {
		data["Authorization"] = auth
	}

	if cookie := arrayHeaderFirstValue(headers["Cookie"]); cookie != "" {
		data["Cookie"] = cookie
	}

	if idToken := arrayHeaderFirstValue(headers["X-ID-Token"]); idToken != "" {
		data["X-ID-Token"] = idToken
	}

	if encType := arrayHeaderFirstValue(headers["Accept-Encoding"]); encType != "" {
		data["Accept-Encoding"] = encType
	}

	return data
}

func callResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender, dsInfo *datasourceInfo, plog log.Logger) error {
	url := req.URL

	// a very basic is-this-url-valid check
	if req.Method != "GET" {
		return fmt.Errorf("invalid resource method: %s", req.Method)
	}
	if (!strings.HasPrefix(url, "labels?")) &&
		(!strings.HasPrefix(url, "label/")) && // the `/label/$label_name/values` form
		(!strings.HasPrefix(url, "series?")) {
		return fmt.Errorf("invalid resource URL: %s", url)
	}
	lokiURL := fmt.Sprintf("/loki/api/v1/%s", url)

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, plog, getHeadersForCallResource(req.Headers))
	encodedBytes, err := api.RawQuery(ctx, lokiURL)

	if err != nil {
		return err
	}

	respHeaders := map[string][]string{
		"content-type": {"application/json"},
	}
	if encodedBytes.Encoding != "" {
		respHeaders["content-encoding"] = []string{encodedBytes.Encoding}
	}
	return sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: respHeaders,
		Body:    encodedBytes.Body,
	})
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		result := backend.NewQueryDataResponse()
		return result, err
	}

	return queryData(ctx, req, dsInfo, s.tracer)
}

func queryData(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, logger.FromContext(ctx), req.Headers)

	queries, err := parseQuery(req)
	if err != nil {
		return result, err
	}

	for _, query := range queries {
		_, span := tracer.Start(ctx, "datasource.loki")
		span.SetAttributes("expr", query.Expr, attribute.Key("expr").String(query.Expr))
		span.SetAttributes("start_unixnano", query.Start, attribute.Key("start_unixnano").Int64(query.Start.UnixNano()))
		span.SetAttributes("stop_unixnano", query.End, attribute.Key("stop_unixnano").Int64(query.End.UnixNano()))

		logger := logger.FromContext(ctx) // get logger with trace-id and other contextual info
		logger.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)

		frames, err := runQuery(ctx, api, query)

		span.End()
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

// we extracted this part of the functionality to make it easy to unit-test it
func runQuery(ctx context.Context, api *LokiAPI, query *lokiQuery) (data.Frames, error) {
	frames, err := api.DataQuery(ctx, *query)
	if err != nil {
		return data.Frames{}, err
	}

	for _, frame := range frames {
		if err = adjustFrame(frame, query); err != nil {
			return data.Frames{}, err
		}
		if err != nil {
			return data.Frames{}, err
		}
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
