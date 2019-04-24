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

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/net/context/ctxhttp"
)

const loggerName = "tsdb.elasticsearch.client"

var (
	clientLog = log.New(loggerName)
)

var newDatasourceHttpClient = func(ds *models.DataSource) (*http.Client, error) {
	return ds.GetHttpClient()
}

// Client represents a client which can interact with elasticsearch api
type Client interface {
	GetVersion() int
	GetTimeField() string
	GetMinInterval(queryInterval string) (time.Duration, error)
	ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error)
	MultiSearch() *MultiSearchRequestBuilder
}

// NewClient creates a new elasticsearch client
var NewClient = func(ctx context.Context, ds *models.DataSource, timeRange *tsdb.TimeRange) (Client, error) {
	version, err := ds.JsonData.Get("esVersion").Int()
	if err != nil {
		return nil, fmt.Errorf("elasticsearch version is required, err=%v", err)
	}

	timeField, err := ds.JsonData.Get("timeField").String()
	if err != nil {
		return nil, fmt.Errorf("elasticsearch time field name is required, err=%v", err)
	}

	indexInterval := ds.JsonData.Get("interval").MustString()
	ip, err := newIndexPattern(indexInterval, ds.Database)
	if err != nil {
		return nil, err
	}

	indices, err := ip.GetIndices(timeRange)
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Creating new client", "version", version, "timeField", timeField, "indices", strings.Join(indices, ", "))

	switch version {
	case 2, 5, 56, 60:
		return &baseClientImpl{
			ctx:       ctx,
			ds:        ds,
			version:   version,
			timeField: timeField,
			indices:   indices,
			timeRange: timeRange,
		}, nil
	}

	return nil, fmt.Errorf("elasticsearch version=%d is not supported", version)
}

type baseClientImpl struct {
	ctx       context.Context
	ds        *models.DataSource
	version   int
	timeField string
	indices   []string
	timeRange *tsdb.TimeRange
}

func (c *baseClientImpl) GetVersion() int {
	return c.version
}

func (c *baseClientImpl) GetTimeField() string {
	return c.timeField
}

func (c *baseClientImpl) GetMinInterval(queryInterval string) (time.Duration, error) {
	return tsdb.GetIntervalFrom(c.ds, simplejson.NewFromAny(map[string]interface{}{
		"interval": queryInterval,
	}), 5*time.Second)
}

func (c *baseClientImpl) getSettings() *simplejson.Json {
	return c.ds.JsonData
}

type multiRequest struct {
	header   map[string]interface{}
	body     interface{}
	interval tsdb.Interval
}

func (c *baseClientImpl) executeBatchRequest(uriPath string, requests []*multiRequest) (*http.Response, error) {
	bytes, err := c.encodeBatchRequests(requests)
	if err != nil {
		return nil, err
	}
	return c.executeRequest(http.MethodPost, uriPath, bytes)
}

func (c *baseClientImpl) encodeBatchRequests(requests []*multiRequest) ([]byte, error) {
	clientLog.Debug("Encoding batch requests to json", "batch requests", len(requests))
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
		body = strings.Replace(body, "$__interval_ms", strconv.FormatInt(r.interval.Milliseconds(), 10), -1)
		body = strings.Replace(body, "$__interval", r.interval.Text, -1)

		payload.WriteString(body + "\n")
	}

	elapsed := time.Since(start)
	clientLog.Debug("Encoded batch requests to json", "took", elapsed)

	return payload.Bytes(), nil
}

func (c *baseClientImpl) executeRequest(method, uriPath string, body []byte) (*http.Response, error) {
	u, _ := url.Parse(c.ds.Url)
	u.Path = path.Join(u.Path, uriPath)

	var req *http.Request
	var err error
	if method == http.MethodPost {
		req, err = http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Executing request", "url", req.URL.String(), "method", method)

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	if c.ds.BasicAuth {
		clientLog.Debug("Request configured to use basic authentication")
		req.SetBasicAuth(c.ds.BasicAuthUser, c.ds.DecryptedBasicAuthPassword())
	}

	if !c.ds.BasicAuth && c.ds.User != "" {
		clientLog.Debug("Request configured to use basic authentication")
		req.SetBasicAuth(c.ds.User, c.ds.DecryptedPassword())
	}

	httpClient, err := newDatasourceHttpClient(c.ds)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		clientLog.Debug("Executed request", "took", elapsed)
	}()
	return ctxhttp.Do(c.ctx, httpClient, req)
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	clientLog.Debug("Executing multisearch", "search requests", len(r.Requests))

	multiRequests := c.createMultiSearchRequests(r.Requests)
	res, err := c.executeBatchRequest("_msearch", multiRequests)
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Received multisearch response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	start := time.Now()
	clientLog.Debug("Decoding multisearch json response")

	var msr MultiSearchResponse
	defer res.Body.Close()
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&msr)
	if err != nil {
		return nil, err
	}

	elapsed := time.Since(start)
	clientLog.Debug("Decoded multisearch json response", "took", elapsed)

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

		if c.version == 2 {
			mr.header["search_type"] = "count"
		}

		if c.version >= 56 {
			maxConcurrentShardRequests := c.getSettings().Get("maxConcurrentShardRequests").MustInt(256)
			mr.header["max_concurrent_shard_requests"] = maxConcurrentShardRequests
		}

		multiRequests = append(multiRequests, &mr)
	}

	return multiRequests
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder(c.GetVersion())
}
