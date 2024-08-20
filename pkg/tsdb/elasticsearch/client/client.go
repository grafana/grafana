package es

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	exp "github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models" // LOGZ.IO GRAFANA CHANGE :: DEV-43883 - add LogzIoHeaders
)

// Used in logging to mark a stage
var (
	StagePrepareRequest  = "prepareRequest"
	StageDatabaseRequest = "databaseRequest"
	StageParseResponse   = "parseResponse"
)

type DatasourceInfo struct {
	ID                         int64
	HTTPClient                 *http.Client
	URL                        string
	Database                   string
	ConfiguredFields           ConfiguredFields
	Interval                   string
	MaxConcurrentShardRequests int64
	IncludeFrozen              bool
	XPack                      bool
}

type ConfiguredFields struct {
	TimeField       string
	LogMessageField string
	LogLevelField   string
}

// Client represents a client which can interact with elasticsearch api
type Client interface {
	GetConfiguredFields() ConfiguredFields
	ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error)
	MultiSearch() *MultiSearchRequestBuilder
}

// NewClient creates a new elasticsearch client
var NewClient = func(ctx context.Context, ds *DatasourceInfo, timeRange backend.TimeRange, logger log.Logger, tracer tracing.Tracer) (Client, error) {
	logger = logger.New("entity", "client")

	ip, err := newIndexPattern(ds.Interval, ds.Database)
	if err != nil {
		logger.Error("Failed creating index pattern", "error", err, "interval", ds.Interval, "index", ds.Database)
		return nil, err
	}

	indices, err := ip.GetIndices(timeRange)
	if err != nil {
		return nil, err
	}
	logger.Debug("Creating new client", "configuredFields", fmt.Sprintf("%#v", ds.ConfiguredFields), "indices", strings.Join(indices, ", "), "interval", ds.Interval, "index", ds.Database)

	// LOGZ.IO GRAFANA CHANGE :: DEV-43883 - add LogzIoHeaders
	logzIoHeaders, ok := models.LogzIoHeadersFromContext(ctx)
	if !ok {
		logzIoHeaders = &models.LogzIoHeaders{}
	}
	// LOGZ.IO GRAFANA CHANGE :: End

	return &baseClientImpl{
		logger:           logger,
		ctx:              ctx,
		ds:               ds,
		configuredFields: ds.ConfiguredFields,
		indices:          indices,
		timeRange:        timeRange,
		tracer:           tracer,
		logzIoHeaders:    logzIoHeaders, // LOGZ.IO GRAFANA CHANGE :: DEV-43883 Support external alert evaluation
	}, nil
}

type baseClientImpl struct {
	ctx              context.Context
	ds               *DatasourceInfo
	configuredFields ConfiguredFields
	indices          []string
	timeRange        backend.TimeRange
	logger           log.Logger
	tracer           tracing.Tracer
	logzIoHeaders    *models.LogzIoHeaders // LOGZ.IO GRAFANA CHANGE :: DEV-43883 - add LogzIoHeaders
}

func (c *baseClientImpl) GetConfiguredFields() ConfiguredFields {
	return c.configuredFields
}

type multiRequest struct {
	header   map[string]any
	body     any
	interval time.Duration
}

func (c *baseClientImpl) executeBatchRequest(uriPath, uriQuery string, requests []*multiRequest) (*http.Response, error) {
	bytes, err := c.encodeBatchRequests(requests)
	if err != nil {
		return nil, err
	}
	return c.executeRequest(http.MethodPost, uriPath, uriQuery, bytes)
}

func (c *baseClientImpl) encodeBatchRequests(requests []*multiRequest) ([]byte, error) {
	start := time.Now()

	payload := bytes.Buffer{}
	for _, r := range requests {
		reqHeader, err := json.Marshal(r.header)
		if err != nil {
			return nil, err
		}
		payload.WriteString(string(reqHeader) + "\n")

		reqBody, err := json.Marshal(r.body)
		if err != nil {
			return nil, err
		}

		body := string(reqBody)
		body = strings.ReplaceAll(body, "$__interval_ms", strconv.FormatInt(r.interval.Milliseconds(), 10))
		body = strings.ReplaceAll(body, "$__interval", r.interval.String())

		payload.WriteString(body + "\n")
	}

	elapsed := time.Since(start)
	c.logger.Debug("Completed encoding of batch requests to json", "duration", elapsed)

	return payload.Bytes(), nil
}

func (c *baseClientImpl) executeRequest(method, uriPath, uriQuery string, body []byte) (*http.Response, error) {
	c.logger.Debug("Sending request to Elasticsearch", "url", c.ds.URL)
	u, err := url.Parse(c.ds.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, uriPath)
	u.RawQuery = uriQuery

	var req *http.Request
	if method == http.MethodPost {
		req, err = http.NewRequestWithContext(c.ctx, http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequestWithContext(c.ctx, http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	req.Header = c.logzIoHeaders.GetDatasourceQueryHeaders(req.Header) // LOGZ.IO GRAFANA CHANGE :: DEV-43883 Support external alert evaluation

	req.Header.Set("Content-Type", "application/json") // LOGZ.IO GRAFANA CHANGE :: DEV-43744 use application/json to interact with query-service
	c.logger.Debug("request details", "headers", req.Header, "url", req.URL.String())
	//nolint:bodyclose
	resp, err := c.ds.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}

	// LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Add error msg
	if resp != nil && (resp.StatusCode < 200 || resp.StatusCode >= 300) {
		errorResponse, err := c.DecodeErrorResponse(resp)
		if err != nil {
			return nil, err
		}
		errMsg := fmt.Sprintf("got bad response status from datasource. StatusCode: %d, Status: %s, RequestId: '%s', Message: %s",
			resp.StatusCode, resp.Status, errorResponse.RequestId, errorResponse.Message)
		c.logger.Error(errMsg)
		return nil, errors.New(errMsg)
	}
	// LOGZ.IO GRAFANA CHANGE :: end

	return resp, nil
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	var err error
	multiRequests := c.createMultiSearchRequests(r.Requests)
	queryParams := c.getMultiSearchQueryParameters()
	_, span := c.tracer.Start(c.ctx, "datasource.elasticsearch.queryData.executeMultisearch", trace.WithAttributes(
		attribute.String("queryParams", queryParams),
		attribute.String("url", c.ds.URL),
	))
	defer func() {
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		span.End()
	}()

	start := time.Now()
	clientRes, err := c.executeBatchRequest("_msearch", queryParams, multiRequests)
	if err != nil {
		status := "error"
		if errors.Is(err, context.Canceled) {
			status = "cancelled"
		}
		lp := []any{"error", err, "status", status, "duration", time.Since(start), "stage", StageDatabaseRequest}
		sourceErr := exp.Error{}
		if errors.As(err, &sourceErr) {
			lp = append(lp, "statusSource", sourceErr.Source())
		}
		if clientRes != nil {
			lp = append(lp, "statusCode", clientRes.StatusCode)
		}
		c.logger.Error("Error received from Elasticsearch", lp...)
		return nil, err
	}
	res := clientRes
	defer func() {
		if err := res.Body.Close(); err != nil {
			c.logger.Warn("Failed to close response body", "error", err)
		}
	}()

	c.logger.Info("Response received from Elasticsearch", "status", "ok", "statusCode", res.StatusCode, "contentLength", res.ContentLength, "duration", time.Since(start), "stage", StageDatabaseRequest)

	start = time.Now()
	var msr MultiSearchResponse
	dec := json.NewDecoder(res.Body)
	_, resSpan := c.tracer.Start(c.ctx, "datasource.elasticsearch.queryData.executeMultisearch.decodeResponse")
	defer func() {
		if err != nil {
			resSpan.RecordError(err)
			resSpan.SetStatus(codes.Error, err.Error())
		}
		resSpan.End()
	}()
	err = dec.Decode(&msr)
	if err != nil {
		c.logger.Error("Failed to decode response from Elasticsearch", "error", err, "duration", time.Since(start))
		return nil, err
	}

	c.logger.Debug("Completed decoding of response from Elasticsearch", "duration", time.Since(start))

	msr.Status = res.StatusCode

	return &msr, nil
}

func (c *baseClientImpl) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := []*multiRequest{}

	for _, searchReq := range searchRequests {
		mr := multiRequest{
			header: map[string]any{
				"search_type":        "query_then_fetch",
				"ignore_unavailable": true,
				"index":              strings.Join(c.indices, ","),
			},
			body:     searchReq,
			interval: searchReq.Interval,
		}

		multiRequests = append(multiRequests, &mr)
	}

	return multiRequests
}

func (c *baseClientImpl) getMultiSearchQueryParameters() string {
	var qs []string

	// LOGZ.IO GRAFANA CHANGE :: DEV-43889 Grafana alerts evaluation - set 'accountsToSearch' and 'querySource' params
	var querySourceFromLogzHeaders []string
	headers := c.logzIoHeaders.RequestHeaders
	if headers != nil {
		querySourceFromLogzHeaders = headers["Query-Source"]
		if len(querySourceFromLogzHeaders) > 0 {
			var qsToAdd string
			if querySourceFromLogzHeaders[0] == "METRICS_ALERTS" {
				qsToAdd = "INTERNAL_METRICS_ALERTS"
			} else {
				qsToAdd = querySourceFromLogzHeaders[0]
			}
			qs = append(qs, fmt.Sprintf("querySource=%s", qsToAdd))
		}
	}

	datasourceUrl, _ := url.Parse(c.ds.URL)
	q, _ := url.ParseQuery(datasourceUrl.RawQuery)
	for key, values := range q {
		if key != "querySource" || len(querySourceFromLogzHeaders) == 0 {
			for _, v := range values {
				qs = append(qs, fmt.Sprintf("%s=%s", key, v))
			}
		}
	}

	// LOGZ.IO end

	maxConcurrentShardRequests := c.ds.MaxConcurrentShardRequests
	if maxConcurrentShardRequests == 0 {
		maxConcurrentShardRequests = 5
	}
	qs = append(qs, fmt.Sprintf("max_concurrent_shard_requests=%d", maxConcurrentShardRequests))

	if c.ds.IncludeFrozen && c.ds.XPack {
		qs = append(qs, "ignore_throttled=false")
	}

	return strings.Join(qs, "&")
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder()
}
