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
	ExecuteSearch(r *SearchRequest) (*SearchResponse, error)
	ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error)
	Search(interval tsdb.Interval) *SearchRequestBuilder
	MultiSearch() *MultiSearchRequestBuilder
	GetIndexMapping() (*IndexMappingResponse, error)
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
			ctx:          ctx,
			ds:           ds,
			version:      version,
			timeField:    timeField,
			indices:      indices,
			timeRange:    timeRange,
			indexPattern: ip,
		}, nil
	}

	return nil, fmt.Errorf("elasticsearch version=%d is not supported", version)
}

type baseClientImpl struct {
	ctx          context.Context
	ds           *models.DataSource
	version      int
	timeField    string
	indices      []string
	timeRange    *tsdb.TimeRange
	indexPattern indexPattern
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

		body := c.replaceVariables(reqBody, r.interval)
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
		req.SetBasicAuth(c.ds.BasicAuthUser, c.ds.BasicAuthPassword)
	}

	if !c.ds.BasicAuth && c.ds.User != "" {
		clientLog.Debug("Request configured to use basic authentication")
		req.SetBasicAuth(c.ds.User, c.ds.Password)
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

func (c *baseClientImpl) ExecuteSearch(r *SearchRequest) (*SearchResponse, error) {
	clientLog.Debug("Executing search")

	uri := strings.Join(c.indices, ",") + "/_search"

	if c.version == 2 {
		uri += "?search_type=count"
	} else {
		uri += "?search_type=query_then_fetch"
	}

	if c.version >= 56 {
		maxConcurrentShardRequests := c.getSettings().Get("maxConcurrentShardRequests").MustInt(256)
		uri += "&max_concurrent_shard_requests=" + strconv.Itoa(maxConcurrentShardRequests)
	}

	uri += "&ignore_unavailable=true"

	clientLog.Debug("Encoding search request to json")
	start := time.Now()

	payload := bytes.Buffer{}
	reqBody, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}

	body := c.replaceVariables(reqBody, r.Interval)
	payload.WriteString(body)

	elapsed := time.Now().Sub(start)
	clientLog.Debug("Encoded search request to json", "took", elapsed)

	res, err := c.executeRequest(http.MethodPost, uri, payload.Bytes())
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Received search response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	start = time.Now()
	clientLog.Debug("Decoding search json response")

	var sr SearchResponse
	defer res.Body.Close()
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&sr)
	if err != nil {
		return nil, err
	}

	elapsed = time.Now().Sub(start)
	clientLog.Debug("Decoded search json response", "took", elapsed)

	sr.StatusCode = res.StatusCode

	return &sr, nil
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

	msr.StatusCode = res.StatusCode

	for _, v := range msr.Responses {
		v.StatusCode = res.StatusCode
	}

	return &msr, nil
}

func (c *baseClientImpl) GetIndexMapping() (*IndexMappingResponse, error) {
	clientLog.Debug("Get index mapping")

	var index string
	var err error

	if len(c.indices) > 0 {
		index = c.indices[0]
	} else {
		index, err = c.indexPattern.GetIndexForToday()
		if err != nil {
			return nil, err
		}
	}

	res, err := c.executeRequest(http.MethodGet, index+"/_mapping", nil)
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Received index mapping response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	start := time.Now()
	clientLog.Debug("Decoding index mapping json response")

	var objmap map[string]interface{}
	defer res.Body.Close()
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&objmap)
	if err != nil {
		return nil, err
	}

	imr := IndexMappingResponse{
		StatusCode: res.StatusCode,
	}

	if val, ok := objmap["error"]; ok {
		imr.Error = val.(map[string]interface{})
	} else {
		imr.Mappings = objmap
	}

	elapsed := time.Now().Sub(start)
	clientLog.Debug("Decoded index mapping json response", "took", elapsed)

	return &imr, nil
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

func (c *baseClientImpl) Search(interval tsdb.Interval) *SearchRequestBuilder {
	return NewSearchRequestBuilder(c.GetVersion(), interval)
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder(c.GetVersion())
}

func (c *baseClientImpl) replaceVariables(payload []byte, interval tsdb.Interval) string {
	body := string(payload)
	body = strings.Replace(body, "$__interval_ms", strconv.FormatInt(interval.Milliseconds(), 10), -1)
	body = strings.Replace(body, "$__interval", interval.Text, -1)
	return body
}
