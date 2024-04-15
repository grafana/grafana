package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	exp "github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	exphttpclient "github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

var eslog = log.New("tsdb.elasticsearch")

const (
	// headerFromExpression is used by data sources to identify expression queries
	headerFromExpression = "X-Grafana-From-Expr"
	// headerFromAlert is used by datasources to identify alert queries
	headerFromAlert = "FromAlert"
)

type Service struct {
	httpClientProvider httpclient.Provider
	im                 instancemgmt.InstanceManager
	tracer             tracing.Tracer
	logger             *log.ConcreteLogger
}

func ProvideService(httpClientProvider httpclient.Provider, tracer tracing.Tracer) *Service {
	return &Service{
		im:                 datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		httpClientProvider: httpClientProvider,
		tracer:             tracer,
		logger:             eslog,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	_, fromAlert := req.Headers[headerFromAlert]
	logger := s.logger.FromContext(ctx).New("fromAlert", fromAlert)

	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return &backend.QueryDataResponse{}, err
	}

	return queryData(ctx, req, dsInfo, logger, s.tracer)
}

// separate function to allow testing the whole transformation and query flow
func queryData(ctx context.Context, req *backend.QueryDataRequest, dsInfo *es.DatasourceInfo, logger log.Logger, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, req.Queries[0].TimeRange, logger, tracer)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	query := newElasticsearchDataQuery(ctx, client, req, logger, tracer)
	return query.execute()
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]any{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		// Set SigV4 service namespace
		if httpCliOpts.SigV4 != nil {
			httpCliOpts.SigV4.Service = "es"
		}

		// set the default middlewars from the httpClientProvider
		httpCliOpts.Middlewares = httpClientProvider.(*sdkhttpclient.Provider).Opts.Middlewares
		// enable experimental http client to support errors with source
		httpCli, err := exphttpclient.New(httpCliOpts)
		if err != nil {
			return nil, err
		}

		// we used to have a field named `esVersion`, please do not use this name in the future.

		timeField, ok := jsonData["timeField"].(string)
		if !ok {
			return nil, errors.New("timeField cannot be cast to string")
		}

		if timeField == "" {
			return nil, errors.New("elasticsearch time field name is required")
		}

		logLevelField, ok := jsonData["logLevelField"].(string)
		if !ok {
			logLevelField = ""
		}

		logMessageField, ok := jsonData["logMessageField"].(string)
		if !ok {
			logMessageField = ""
		}

		interval, ok := jsonData["interval"].(string)
		if !ok {
			interval = ""
		}

		index, ok := jsonData["index"].(string)
		if !ok {
			index = ""
		}
		if index == "" {
			index = settings.Database
		}

		var maxConcurrentShardRequests float64

		switch v := jsonData["maxConcurrentShardRequests"].(type) {
		case float64:
			maxConcurrentShardRequests = v
		case string:
			maxConcurrentShardRequests, err = strconv.ParseFloat(v, 64)
			if err != nil {
				maxConcurrentShardRequests = 256
			}
		default:
			maxConcurrentShardRequests = 256
		}

		includeFrozen, ok := jsonData["includeFrozen"].(bool)
		if !ok {
			includeFrozen = false
		}

		xpack, ok := jsonData["xpack"].(bool)
		if !ok {
			xpack = false
		}

		configuredFields := es.ConfiguredFields{
			TimeField:       timeField,
			LogLevelField:   logLevelField,
			LogMessageField: logMessageField,
		}

		model := es.DatasourceInfo{
			ID:                         settings.ID,
			URL:                        settings.URL,
			HTTPClient:                 httpCli,
			Database:                   index,
			MaxConcurrentShardRequests: int64(maxConcurrentShardRequests),
			ConfiguredFields:           configuredFields,
			Interval:                   interval,
			IncludeFrozen:              includeFrozen,
			XPack:                      xpack,
		}
		return model, nil
	}
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*es.DatasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(es.DatasourceInfo)

	return &instance, nil
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := eslog.FromContext(ctx)
	// allowed paths for resource calls:
	// - empty string for fetching db version
	// - /_mapping for fetching index mapping, e.g. requests going to `index/_mapping`
	// - _msearch for executing getTerms queries
	// - _mapping for fetching "root" index mappings
	if req.Path != "" && !strings.HasSuffix(req.Path, "/_mapping") && req.Path != "_msearch" && req.Path != "_mapping" {
		logger.Error("Invalid resource path", "path", req.Path)
		return fmt.Errorf("invalid resource URL: %s", req.Path)
	}

	ds, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return err
	}

	esUrl, err := createElasticsearchURL(req, ds)
	if err != nil {
		logger.Error("Failed to create request url", "error", err, "url", ds.URL, "path", req.Path)
	}

	request, err := http.NewRequestWithContext(ctx, req.Method, esUrl.String(), bytes.NewBuffer(req.Body))
	if err != nil {
		logger.Error("Failed to create request", "error", err, "url", esUrl.String())
		return err
	}

	logger.Debug("Sending request to Elasticsearch", "resourcePath", req.Path)
	start := time.Now()
	response, err := ds.HTTPClient.Do(request)
	if err != nil {
		status := "error"
		if errors.Is(err, context.Canceled) {
			status = "cancelled"
		}
		lp := []any{"error", err, "status", status, "duration", time.Since(start), "stage", es.StageDatabaseRequest, "resourcePath", req.Path}
		sourceErr := exp.Error{}
		if errors.As(err, &sourceErr) {
			lp = append(lp, "statusSource", sourceErr.Source())
		}
		if response != nil {
			lp = append(lp, "statusCode", response.StatusCode)
		}
		logger.Error("Error received from Elasticsearch", lp...)
		return err
	}
	logger.Info("Response received from Elasticsearch", "statusCode", response.StatusCode, "status", "ok", "duration", time.Since(start), "stage", es.StageDatabaseRequest, "contentLength", response.Header.Get("Content-Length"), "resourcePath", req.Path)

	defer func() {
		if err := response.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "error", err)
		}
	}()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		logger.Error("Error reading response body bytes", "error", err)
		return err
	}

	responseHeaders := map[string][]string{
		"content-type": {"application/json"},
	}

	if response.Header.Get("Content-Encoding") != "" {
		responseHeaders["content-encoding"] = []string{response.Header.Get("Content-Encoding")}
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  response.StatusCode,
		Headers: responseHeaders,
		Body:    body,
	})
}

func createElasticsearchURL(req *backend.CallResourceRequest, ds *es.DatasourceInfo) (*url.URL, error) {
	esUrl, err := url.Parse(ds.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse data source URL: %s, error: %w", ds.URL, err)
	}

	esUrl.Path = path.Join(esUrl.Path, req.Path)
	return esUrl, nil
}
