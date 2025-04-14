package es

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
	}, nil
}

type baseClientImpl struct {
	ctx              context.Context
	ds               *DatasourceInfo
	configuredFields ConfiguredFields
	indexPattern     IndexPattern
	logger           log.Logger
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
		return nil, backend.DownstreamError(fmt.Errorf("URL could not be parsed: %w", err))
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

	req.Header.Set("Content-Type", "application/x-ndjson")

	//nolint:bodyclose
	resp, err := c.ds.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
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

	start = time.Now()
	_, resSpan := tracing.DefaultTracer().Start(c.ctx, "datasource.elasticsearch.queryData.executeMultisearch.decodeResponse")
	defer func() {
		if err != nil {
			resSpan.RecordError(err)
			resSpan.SetStatus(codes.Error, err.Error())
		}
		resSpan.End()
	}()

	var msr MultiSearchResponse
	improvedParsingEnabled := isFeatureEnabled(c.ctx, featuremgmt.FlagElasticsearchImprovedParsing)
	if improvedParsingEnabled {
		err = StreamMultiSearchResponse(res.Body, &msr)
	} else {
		dec := json.NewDecoder(res.Body)
		err = dec.Decode(&msr)
		if err != nil {
			// Invalid JSON response from Elasticsearch
			err = backend.DownstreamError(err)
		}
	}
	if err != nil {
		c.logger.Error("Failed to decode response from Elasticsearch", "error", err, "duration", time.Since(start), "improvedParsingEnabled", improvedParsingEnabled)
		return nil, err
	}

	c.logger.Debug("Completed decoding of response from Elasticsearch", "duration", time.Since(start), "improvedParsingEnabled", improvedParsingEnabled)

	msr.Status = res.StatusCode

	return &msr, nil
}

// StreamMultiSearchResponse processes the JSON response in a streaming fashion
func StreamMultiSearchResponse(body io.Reader, msr *MultiSearchResponse) error {
	dec := json.NewDecoder(body)

	_, err := dec.Token() // reads the `{` opening brace
	if err != nil {
		// Invalid JSON response from Elasticsearch
		return backend.DownstreamError(err)
	}

	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return err
		}

		if tok == "responses" {
			_, err := dec.Token() // reads the `[` opening bracket for responses array
			if err != nil {
				return err
			}

			for dec.More() {
				var sr SearchResponse

				_, err := dec.Token() // reads `{` for each SearchResponse
				if err != nil {
					return err
				}

				for dec.More() {
					field, err := dec.Token()
					if err != nil {
						return err
					}

					switch field {
					case "hits":
						sr.Hits = &SearchResponseHits{}
						err := processHits(dec, &sr)
						if err != nil {
							return err
						}
					case "aggregations":
						err := dec.Decode(&sr.Aggregations)
						if err != nil {
							return err
						}
					case "error":
						err := dec.Decode(&sr.Error)
						if err != nil {
							return err
						}
					default:
						// skip over unknown fields
						err := skipUnknownField(dec)
						if err != nil {
							return err
						}
					}
				}

				msr.Responses = append(msr.Responses, &sr)

				_, err = dec.Token() // reads `}` closing for each SearchResponse
				if err != nil {
					return err
				}
			}

			_, err = dec.Token() // reads the `]` closing bracket for responses array
			if err != nil {
				return err
			}
		} else {
			err := skipUnknownField(dec)
			if err != nil {
				return err
			}
		}
	}

	_, err = dec.Token() // reads the `}` closing brace for the entire JSON
	return err
}

// processHits processes the hits in the JSON response incrementally.
func processHits(dec *json.Decoder, sr *SearchResponse) error {
	tok, err := dec.Token() // reads the `{` opening brace for the hits object
	if err != nil {
		return err
	}

	if tok != json.Delim('{') {
		return fmt.Errorf("expected '{' for hits object, got %v", tok)
	}

	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return err
		}

		if tok == "hits" {
			if err := streamHitsArray(dec, sr); err != nil {
				return err
			}
		} else {
			// ignore these fields as they are not used in the current implementation
			err := skipUnknownField(dec)
			if err != nil {
				return err
			}
		}
	}

	// read the closing `}` for the hits object
	_, err = dec.Token()
	if err != nil {
		return err
	}

	return nil
}

// streamHitsArray processes the hits array field incrementally.
func streamHitsArray(dec *json.Decoder, sr *SearchResponse) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	// read the opening `[` for the hits array
	if tok != json.Delim('[') {
		return fmt.Errorf("expected '[' for hits array, got %v", tok)
	}

	for dec.More() {
		var hit map[string]interface{}
		err = dec.Decode(&hit)
		if err != nil {
			return err
		}

		sr.Hits.Hits = append(sr.Hits.Hits, hit)
	}

	// read the closing bracket `]` for the hits array
	tok, err = dec.Token()
	if err != nil {
		return err
	}

	if tok != json.Delim(']') {
		return fmt.Errorf("expected ']' for closing hits array, got %v", tok)
	}

	return nil
}

// skipUnknownField skips over an unknown JSON field's value in the stream.
func skipUnknownField(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	switch tok {
	case json.Delim('{'):
		// skip everything inside the object until we reach the closing `}`
		for dec.More() {
			if err := skipUnknownField(dec); err != nil {
				return err
			}
		}
		_, err = dec.Token() // read the closing `}`
		return err
	case json.Delim('['):
		// skip everything inside the array until we reach the closing `]`
		for dec.More() {
			if err := skipUnknownField(dec); err != nil {
				return err
			}
		}
		_, err = dec.Token() // read the closing `]`
		return err
	default:
		// no further action needed for primitives
		return nil
	}
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
