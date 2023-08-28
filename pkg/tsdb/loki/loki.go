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
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
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
	dataquery.LokiDataQuery
	Direction           *string `json:"direction,omitempty"`
	SupportingQueryType *string `json:"supportingQueryType"`
}

type ResponseOpts struct {
	metricDataplane bool
	logsDataplane   bool
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

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	logger := logger.FromContext(ctx).New("api", "CallResource")
	if err != nil {
		logger.Error("failed to get data source info", "err", err)
		return err
	}
	return callResource(ctx, req, sender, dsInfo, logger, s.tracer)
}

func callResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender, dsInfo *datasourceInfo, plog log.Logger, tracer tracing.Tracer) error {
	url := req.URL
	// a very basic is-this-url-valid check
	if req.Method != "GET" {
		plog.Error("invalid HTTP method", "method", req.Method)
		return fmt.Errorf("invalid HTTP method: %s", req.Method)
	}
	if (!strings.HasPrefix(url, "labels?")) &&
		(!strings.HasPrefix(url, "label/")) && // the `/label/$label_name/values` form
		(!strings.HasPrefix(url, "series?")) &&
		(!strings.HasPrefix(url, "index/stats?")) {
		plog.Error("invalid URL", "url", url)
		return fmt.Errorf("invalid URL: %s", url)
	}
	lokiURL := fmt.Sprintf("/loki/api/v1/%s", url)

	ctx, span := tracer.Start(ctx, "datasource.loki.CallResource")
	span.SetAttributes("url", lokiURL, attribute.Key("url").String(lokiURL))
	defer span.End()

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, plog, tracer)

	rawLokiResponse, err := api.RawQuery(ctx, lokiURL)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		plog.Error("failed resource call from loki", "err", err, "url", lokiURL)
		return err
	}
	respHeaders := map[string][]string{
		"content-type": {"application/json"},
	}
	if rawLokiResponse.Encoding != "" {
		respHeaders["content-encoding"] = []string{rawLokiResponse.Encoding}
	}
	return sender.Send(&backend.CallResourceResponse{
		Status:  rawLokiResponse.Status,
		Headers: respHeaders,
		Body:    rawLokiResponse.Body,
	})
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	_, fromAlert := req.Headers[ngalertmodels.FromAlertHeaderName]
	logger := logger.FromContext(ctx).New("api", "QueryData", "fromAlert", fromAlert)
	if err != nil {
		logger.Error("Failed to get data source info", "err", err)
		result := backend.NewQueryDataResponse()
		return result, err
	}

	responseOpts := ResponseOpts{
		metricDataplane: s.features.IsEnabled(featuremgmt.FlagLokiMetricDataplane),
		logsDataplane:   s.features.IsEnabled(featuremgmt.FlagLokiLogsDataplane),
	}

	return queryData(ctx, req, dsInfo, responseOpts, s.tracer, logger)
}

func queryData(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo, responseOpts ResponseOpts, tracer tracing.Tracer, plog log.Logger) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, plog, tracer)

	queries, err := parseQuery(req)
	if err != nil {
		plog.Error("Failed to parse queries", "err", err)
		return result, err
	}

	for _, query := range queries {
		ctx, span := tracer.Start(ctx, "datasource.loki.queryData.runQuery")
		span.SetAttributes("expr", query.Expr, attribute.Key("expr").String(query.Expr))
		span.SetAttributes("start_unixnano", query.Start, attribute.Key("start_unixnano").Int64(query.Start.UnixNano()))
		span.SetAttributes("stop_unixnano", query.End, attribute.Key("stop_unixnano").Int64(query.End.UnixNano()))

		if req.GetHTTPHeader("X-Query-Group-Id") != "" {
			span.SetAttributes("query_group_id", req.GetHTTPHeader("X-Query-Group-Id"), attribute.Key("query_group_id").String(req.GetHTTPHeader("X-Query-Group-Id")))
		}

		frames, err := runQuery(ctx, api, query, responseOpts)

		queryRes := backend.DataResponse{}

		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			queryRes.Error = err
		} else {
			queryRes.Frames = frames
		}

		result.Responses[query.RefID] = queryRes
		span.End()
	}
	return result, nil
}

// we extracted this part of the functionality to make it easy to unit-test it
func runQuery(ctx context.Context, api *LokiAPI, query *lokiQuery, responseOpts ResponseOpts) (data.Frames, error) {
	frames, err := api.DataQuery(ctx, *query, responseOpts)
	if err != nil {
		logger.Error("Error querying loki", "err", err)
		return data.Frames{}, err
	}

	for _, frame := range frames {
		err = adjustFrame(frame, query, !responseOpts.metricDataplane, responseOpts.logsDataplane)

		if err != nil {
			logger.Error("Error adjusting frame", "err", err)
			return data.Frames{}, err
		}
	}

	return frames, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast data source info")
	}

	return instance, nil
}
