package es

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Used in logging to mark a stage
const (
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
var NewClient = func(ctx context.Context, ds *DatasourceInfo, logger log.Logger) (Client, error) {
	logger = logger.FromContext(ctx).With("entity", "client")

	ip, err := NewIndexPattern(ds.Interval, ds.Database)
	if err != nil {
		logger.Error("Failed creating index pattern", "error", err, "interval", ds.Interval, "index", ds.Database)
		return nil, err
	}

	logger.Debug("Creating new client", "configuredFields", fmt.Sprintf("%#v", ds.ConfiguredFields), "interval", ds.Interval, "index", ds.Database)

	return &baseClientImpl{
		logger:           logger,
		ctx:              ctx,
		ds:               ds,
		configuredFields: ds.ConfiguredFields,
		indexPattern:     ip,
		transport:        newHTTPTransport(ctx, ds.HTTPClient, ds.URL, logger),
		encoder:          newRequestEncoder(logger),
		parser:           newResponseParser(logger),
	}, nil
}

type baseClientImpl struct {
	ctx              context.Context
	ds               *DatasourceInfo
	configuredFields ConfiguredFields
	indexPattern     IndexPattern
	logger           log.Logger
	transport        *httpTransport
	encoder          *requestEncoder
	parser           *responseParser
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
	payload, err := c.encoder.encodeBatchRequests(requests)
	if err != nil {
		return nil, err
	}
	return c.transport.executeBatchRequest(uriPath, uriQuery, payload)
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	var err error
	multiRequests, err := c.createMultiSearchRequests(r.Requests)
	if err != nil {
		return nil, err
	}

	queryParams := c.getMultiSearchQueryParameters()
	_, span := tracing.DefaultTracer().Start(c.ctx, "datasource.elasticsearch.queryData.executeMultisearch", trace.WithAttributes(
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
		sourceErr := backend.ErrorWithSource{}
		if errors.As(err, &sourceErr) {
			lp = append(lp, "statusSource", sourceErr.ErrorSource())
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

	_, resSpan := tracing.DefaultTracer().Start(c.ctx, "datasource.elasticsearch.queryData.executeMultisearch.decodeResponse")
	defer func() {
		if err != nil {
			resSpan.RecordError(err)
			resSpan.SetStatus(codes.Error, err.Error())
		}
		resSpan.End()
	}()

	improvedParsingEnabled := isFeatureEnabled(c.ctx, featuremgmt.FlagElasticsearchImprovedParsing)
	msr, err := c.parser.parseMultiSearchResponse(res.Body, improvedParsingEnabled)
	if err != nil {
		return nil, err
	}

	msr.Status = res.StatusCode

	return msr, nil
}


func (c *baseClientImpl) createMultiSearchRequests(searchRequests []*SearchRequest) ([]*multiRequest, error) {
	multiRequests := []*multiRequest{}

	for _, searchReq := range searchRequests {
		indices, err := c.indexPattern.GetIndices(searchReq.TimeRange)
		if err != nil {
			err := fmt.Errorf("failed to get indices from index pattern. %s", err)
			return nil, backend.DownstreamError(err)
		}
		mr := multiRequest{
			header: map[string]any{
				"search_type":        "query_then_fetch",
				"ignore_unavailable": true,
				"index":              strings.Join(indices, ","),
			},
			body:     searchReq,
			interval: searchReq.Interval,
		}

		multiRequests = append(multiRequests, &mr)
	}

	return multiRequests, nil
}

func (c *baseClientImpl) getMultiSearchQueryParameters() string {
	var qs []string
	qs = append(qs, fmt.Sprintf("max_concurrent_shard_requests=%d", c.ds.MaxConcurrentShardRequests))

	if c.ds.IncludeFrozen {
		qs = append(qs, "ignore_throttled=false")
	}

	return strings.Join(qs, "&")
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder()
}

func isFeatureEnabled(ctx context.Context, feature string) bool {
	return backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}

// StreamMultiSearchResponse processes the JSON response in a streaming fashion
// This is a public wrapper for backward compatibility
func StreamMultiSearchResponse(body io.Reader, msr *MultiSearchResponse) error {
	parser := newResponseParser(log.NewNullLogger())
	return parser.streamMultiSearchResponse(body, msr)
}
