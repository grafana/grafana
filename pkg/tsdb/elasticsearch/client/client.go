package es

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
)

type DatasourceInfo struct {
	ID                         int64
	HTTPClient                 *http.Client
	URL                        string
	Database                   string
	ESVersion                  *semver.Version
	ConfiguredFields           ConfiguredFields
	Interval                   string
	TimeInterval               string
	MaxConcurrentShardRequests int64
	IncludeFrozen              bool
	XPack                      bool
}

type ConfiguredFields struct {
	TimeField       string
	LogMessageField string
	LogLevelField   string
}

const loggerName = "tsdb.elasticsearch.client"

// Client represents a client which can interact with elasticsearch api
type Client interface {
	GetConfiguredFields() ConfiguredFields
	ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error)
	MultiSearch() *MultiSearchRequestBuilder
}

// NewClient creates a new elasticsearch client
var NewClient = func(ctx context.Context, ds *DatasourceInfo, timeRange backend.TimeRange) (Client, error) {
	ip, err := newIndexPattern(ds.Interval, ds.Database)
	if err != nil {
		return nil, err
	}

	indices, err := ip.GetIndices(timeRange)
	if err != nil {
		return nil, err
	}

	logger := log.New(loggerName).FromContext(ctx)
	logger.Debug("Creating new client", "version", ds.ESVersion, "configuredFields", fmt.Sprintf("%#v", ds.ConfiguredFields), "indices", strings.Join(indices, ", "))

	return &baseClientImpl{
		logger:           logger,
		ctx:              ctx,
		ds:               ds,
		configuredFields: ds.ConfiguredFields,
		indices:          indices,
		timeRange:        timeRange,
	}, nil
}

type baseClientImpl struct {
	ctx              context.Context
	ds               *DatasourceInfo
	configuredFields ConfiguredFields
	indices          []string
	timeRange        backend.TimeRange
	logger           log.Logger
}

func (c *baseClientImpl) GetConfiguredFields() ConfiguredFields {
	return c.configuredFields
}

type multiRequest struct {
	header   map[string]interface{}
	body     interface{}
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
	c.logger.Debug("Encoding batch requests to json", "batch requests", len(requests))
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
	c.logger.Debug("Encoded batch requests to json", "took", elapsed)

	return payload.Bytes(), nil
}

func (c *baseClientImpl) executeRequest(method, uriPath, uriQuery string, body []byte) (*http.Response, error) {
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

	c.logger.Debug("Executing request", "url", req.URL.String(), "method", method)

	req.Header.Set("Content-Type", "application/x-ndjson")

	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		c.logger.Debug("Executed request", "took", elapsed)
	}()
	//nolint:bodyclose
	resp, err := c.ds.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	c.logger.Debug("Executing multisearch", "search requests", len(r.Requests))

	multiRequests := c.createMultiSearchRequests(r.Requests)
	queryParams := c.getMultiSearchQueryParameters()
	clientRes, err := c.executeBatchRequest("_msearch", queryParams, multiRequests)
	if err != nil {
		return nil, err
	}
	res := clientRes
	defer func() {
		if err := res.Body.Close(); err != nil {
			c.logger.Warn("Failed to close response body", "err", err)
		}
	}()

	c.logger.Debug("Received multisearch response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	start := time.Now()
	c.logger.Debug("Decoding multisearch json response")

	var msr MultiSearchResponse
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&msr)
	if err != nil {
		return nil, err
	}

	elapsed := time.Since(start)
	c.logger.Debug("Decoded multisearch json response", "took", elapsed)

	msr.Status = res.StatusCode

	return &msr, nil
}

func (c *baseClientImpl) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := []*multiRequest{}

	for _, searchReq := range searchRequests {
		mr := multiRequest{
			header: map[string]interface{}{
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
