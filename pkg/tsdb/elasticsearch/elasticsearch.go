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
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

const (
	// headerFromExpression is used by data sources to identify expression queries
	headerFromExpression = "X-Grafana-From-Expr"
	// headerFromAlert is used by data sources to identify alert queries
	headerFromAlert = "FromAlert"
	// this is the default value for the maxConcurrentShardRequests setting - it should be in sync with the default value in the datasource config settings
	defaultMaxConcurrentShardRequests = int64(5)
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: backend.NewLoggerWith("logger", "tsdb.elasticsearch"),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	_, fromAlert := req.Headers[headerFromAlert]
	logger := s.logger.FromContext(ctx).With("fromAlert", fromAlert)

	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return &backend.QueryDataResponse{}, err
	}

	return queryData(ctx, req, dsInfo, logger)
}

// separate function to allow testing the whole transformation and query flow
func queryData(ctx context.Context, req *backend.QueryDataRequest, dsInfo *es.DatasourceInfo, logger log.Logger) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, logger)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	query := newElasticsearchDataQuery(ctx, client, req, logger)
	return query.execute()
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
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

		httpCli, err := httpClientProvider.New(httpCliOpts)
		if err != nil {
			return nil, err
		}

		// we used to have a field named `esVersion`, please do not use this name in the future.

		timeField, ok := jsonData["timeField"].(string)
		if !ok {
			return nil, backend.DownstreamError(errors.New("timeField cannot be cast to string"))
		}

		if timeField == "" {
			return nil, backend.DownstreamError(errors.New("elasticsearch time field name is required"))
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

		var maxConcurrentShardRequests int64

		switch v := jsonData["maxConcurrentShardRequests"].(type) {
		// unmarshalling from JSON will return float64 for numbers, so we need to handle that and convert to int64
		case float64:
			maxConcurrentShardRequests = int64(v)
		case string:
			maxConcurrentShardRequests, err = strconv.ParseInt(v, 10, 64)
			if err != nil {
				maxConcurrentShardRequests = defaultMaxConcurrentShardRequests
			}
		default:
			maxConcurrentShardRequests = defaultMaxConcurrentShardRequests
		}

		if maxConcurrentShardRequests <= 0 {
			maxConcurrentShardRequests = defaultMaxConcurrentShardRequests
		}

		includeFrozen, ok := jsonData["includeFrozen"].(bool)
		if !ok {
			includeFrozen = false
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
			MaxConcurrentShardRequests: maxConcurrentShardRequests,
			ConfiguredFields:           configuredFields,
			Interval:                   interval,
			IncludeFrozen:              includeFrozen,
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

func isFieldCaps(url string) bool {
	return strings.HasSuffix(url, "/_field_caps") || url == "_field_caps"
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := s.logger.FromContext(ctx)
	// allowed paths for resource calls:
	// - empty string for fetching db version
	// - /_mapping for fetching index mapping, e.g. requests going to `index/_mapping`
	// - /_field_caps for fetching field capabilities, e.g. requests going to `index/_field_caps`
	// - _msearch for executing getTerms queries
	// - _mapping for fetching "root" index mappings
	// - _field_caps for fetching "root" field capabilities
	if req.Path != "" && !isFieldCaps(req.Path) && req.Path != "_msearch" &&
		!strings.HasSuffix(req.Path, "/_mapping") && req.Path != "_mapping" {
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

	request, err := http.NewRequestWithContext(ctx, req.Method, esUrl, bytes.NewBuffer(req.Body))
	if err != nil {
		logger.Error("Failed to create request", "error", err, "url", esUrl)
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
		sourceErr := backend.ErrorWithSource{}
		if errors.As(err, &sourceErr) {
			lp = append(lp, "statusSource", sourceErr.ErrorSource())
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

func createElasticsearchURL(req *backend.CallResourceRequest, ds *es.DatasourceInfo) (string, error) {
	esUrl, err := url.Parse(ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse data source URL: %s, error: %w", ds.URL, err)
	}

	esUrl.Path = path.Join(esUrl.Path, req.Path)
	if isFieldCaps(req.Path) {
		esUrl.RawQuery = "fields=*"
	}
	esUrlString := esUrl.String()
	// If the request path is empty and the URL does not end with a slash, add a slash to the URL.
	// This ensures that for version checks executed to the root URL, the URL ends with a slash.
	// This is helpful, for example, for load balancers that expect URLs to match the pattern /.*.
	if req.Path == "" && esUrlString[len(esUrlString)-1:] != "/" {
		return esUrl.String() + "/", nil
	}
	return esUrlString, nil
}
