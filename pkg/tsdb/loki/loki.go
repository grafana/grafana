package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

const (
	flagLokiLogsDataplane         = "lokiLogsDataplane"
	flagLokiRunQueriesInParallel  = "lokiRunQueriesInParallel"
	flagLogQLScope                = "logQLScope"
	flagLokiExperimentalStreaming = "lokiExperimentalStreaming"
	fromAlertHeaderName           = "FromAlert"
)

type Service struct {
	im     instancemgmt.InstanceManager
	tracer trace.Tracer
	logger log.Logger
}

var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.StreamHandler       = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
)

func ProvideService(httpClientProvider *httpclient.Provider, tracer trace.Tracer) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		tracer: tracer,
		logger: backend.NewLoggerWith("logger", "tsdb.loki"),
	}
}

var (
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

	stagePrepareRequest  = "prepareRequest"
	stageDatabaseRequest = "databaseRequest"
	stageParseResponse   = "parseResponse"
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
	Direction           *string              `json:"direction,omitempty"`
	SupportingQueryType *string              `json:"supportingQueryType"`
	Scopes              []models.ScopeFilter `json:"scopes"`
}

type ResponseOpts struct {
	logsDataplane bool
}

func parseQueryModel(raw json.RawMessage) (*QueryJSONModel, error) {
	model := &QueryJSONModel{}
	err := json.Unmarshal(raw, model)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to parse query model: %w", err))
	}
	return model, nil
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, backend.DownstreamError(fmt.Errorf("error reading settings: %w", err))
		}
		opts.ForwardHTTPHeaders = true

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, backend.DownstreamError(fmt.Errorf("error creating http client: %w", err))
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
	logger := s.logger.FromContext(ctx)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return err
	}
	return callResource(ctx, req, sender, dsInfo, logger, s.tracer)
}

func callResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender, dsInfo *datasourceInfo, plog log.Logger, tracer trace.Tracer) error {
	url := req.URL

	lokiURL := fmt.Sprintf("/loki/api/v1/%s", url)

	ctx, span := tracer.Start(ctx, "datasource.loki.CallResource", trace.WithAttributes(
		attribute.String("url", lokiURL),
	))
	defer span.End()

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, plog, tracer)

	var rawLokiResponse RawLokiResponse
	var err error

	// suggestions is a resource endpoint that will return label and label value suggestions based
	// on queries and the existing scope. By moving this to the backend we can use the logql parser to
	// rewrite queries safely.
	if req.Method == http.MethodPost && strings.EqualFold(req.Path, "suggestions") {
		rawLokiResponse, err = GetSuggestions(ctx, api, req)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			plog.FromContext(ctx).Error("Failed to get suggestions from loki", "err", err)
			return err
		}
	} else {
		rawLokiResponse, err = api.RawQuery(ctx, lokiURL)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			plog.Error("Failed resource call from loki", "err", err, "url", lokiURL)
			return err
		}
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
	_, fromAlert := req.Headers[fromAlertHeaderName]
	logger := s.logger.FromContext(ctx).With("fromAlert", fromAlert)
	if err != nil {
		logger.Debug("Failed to get data source info", "err", err)
		return nil, err
	}

	responseOpts := ResponseOpts{
		logsDataplane: isFeatureEnabled(ctx, flagLokiLogsDataplane),
	}

	return queryData(ctx, req, dsInfo, responseOpts, s.tracer, logger, isFeatureEnabled(ctx, flagLokiRunQueriesInParallel), isFeatureEnabled(ctx, flagLogQLScope))
}

func queryData(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo, responseOpts ResponseOpts, tracer trace.Tracer, plog log.Logger, runInParallel bool, logQLScopes bool) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	api := newLokiAPI(dsInfo.HTTPClient, dsInfo.URL, plog, tracer)

	start := time.Now()
	queries, err := parseQuery(req, logQLScopes)
	if err != nil {
		plog.Debug("Failed to prepare request to Loki", "error", err, "duration", time.Since(start), "queriesLength", len(queries), "stage", stagePrepareRequest)
		return result, err
	}

	plog.Debug("Prepared request to Loki", "duration", time.Since(start), "queriesLength", len(queries), "stage", stagePrepareRequest, "runInParallel", runInParallel)

	ctx, span := tracer.Start(ctx, "datasource.loki.queryData.runQueries", trace.WithAttributes(
		attribute.Bool("runInParallel", runInParallel),
		attribute.Int("queriesLength", len(queries)),
	))
	if req.GetHTTPHeader("X-Query-Group-Id") != "" {
		span.SetAttributes(attribute.String("query_group_id", req.GetHTTPHeader("X-Query-Group-Id")))
	}
	defer span.End()
	start = time.Now()

	// We are testing running of queries in parallel behind feature flag
	if runInParallel {
		resultLock := sync.Mutex{}
		err = concurrency.ForEachJob(ctx, len(queries), 10, func(ctx context.Context, idx int) error {
			query := queries[idx]
			queryRes := executeQuery(ctx, query, req, runInParallel, api, responseOpts, tracer, plog)

			resultLock.Lock()
			defer resultLock.Unlock()
			result.Responses[query.RefID] = queryRes
			return nil // errors are saved per-query,always return nil
		})
	} else {
		for _, query := range queries {
			queryRes := executeQuery(ctx, query, req, runInParallel, api, responseOpts, tracer, plog)
			result.Responses[query.RefID] = queryRes
		}
	}
	plog.Debug("Executed queries", "duration", time.Since(start), "queriesLength", len(queries), "runInParallel", runInParallel)
	return result, err
}

func executeQuery(ctx context.Context, query *lokiQuery, req *backend.QueryDataRequest, runInParallel bool, api *LokiAPI, responseOpts ResponseOpts, tracer trace.Tracer, plog log.Logger) backend.DataResponse {
	ctx, span := tracer.Start(ctx, "datasource.loki.queryData.runQueries.runQuery", trace.WithAttributes(
		attribute.Bool("runInParallel", runInParallel),
		attribute.String("expr", query.Expr),
		attribute.Int64("start_unixnano", query.Start.UnixNano()),
		attribute.Int64("stop_unixnano", query.End.UnixNano()),
	))
	if req.GetHTTPHeader("X-Query-Group-Id") != "" {
		span.SetAttributes(attribute.String("query_group_id", req.GetHTTPHeader("X-Query-Group-Id")))
	}

	defer span.End()

	queryRes, err := runQuery(ctx, api, query, responseOpts, plog)
	if queryRes == nil {
		// we always want to return a backend.DataResponse object, even if we received just an error
		queryRes = &backend.DataResponse{}
	}

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		errResp := backend.ErrorResponseWithErrorSource(err)
		queryRes = &errResp
	}

	return *queryRes
}

// we extracted this part of the functionality to make it easy to unit-test it
func runQuery(ctx context.Context, api *LokiAPI, query *lokiQuery, responseOpts ResponseOpts, plog log.Logger) (*backend.DataResponse, error) {
	res, err := api.DataQuery(ctx, *query, responseOpts)
	if err != nil {
		plog.Debug("Error querying loki", "error", err)
		return res, err
	}

	for _, frame := range res.Frames {
		// Skip frames without fields
		if len(frame.Fields) < 2 {
			continue
		}

		err = adjustFrame(frame, query, false, responseOpts.logsDataplane)
		if err != nil {
			plog.Debug("Error adjusting frame", "error", err)
			return res, err
		}
	}

	return res, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to get data source info: %w", err))
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, backend.DownstreamError(fmt.Errorf("failed to cast data source info"))
	}

	return instance, nil
}

func isFeatureEnabled(ctx context.Context, feature string) bool {
	return backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}
