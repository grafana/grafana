package es

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
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
	clientLog          = log.New(loggerName)
	intervalCalculator = tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: 15 * time.Second})
)

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
		return nil, fmt.Errorf("eleasticsearch version is required, err=%v", err)
	}

	timeField, err := ds.JsonData.Get("timeField").String()
	if err != nil {
		return nil, fmt.Errorf("eleasticsearch time field name is required, err=%v", err)
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

	bc := &baseClientImpl{
		ctx:       ctx,
		ds:        ds,
		version:   version,
		timeField: timeField,
		indices:   indices,
	}

	clientLog.Debug("Creating new client", "version", version, "timeField", timeField, "indices", strings.Join(indices, ", "))

	switch version {
	case 2:
		return newV2Client(bc)
	case 5:
		return newV5Client(bc)
	case 56:
		return newV56Client(bc)
	}

	return nil, fmt.Errorf("elasticsearch version=%d is not supported", version)
}

type baseClient interface {
	Client
	getSettings() *simplejson.Json
	executeBatchRequest(uriPath string, requests []*multiRequest) (*http.Response, error)
	executeRequest(method, uriPath string, body []byte) (*http.Response, error)
	createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest
}

type baseClientImpl struct {
	ctx       context.Context
	ds        *models.DataSource
	version   int
	timeField string
	indices   []string
}

func (c *baseClientImpl) GetVersion() int {
	return c.version
}

func (c *baseClientImpl) GetTimeField() string {
	return c.timeField
}

func (c *baseClientImpl) GetMinInterval(queryInterval string) (time.Duration, error) {
	return tsdb.GetIntervalFrom(c.ds, simplejson.NewFromAny(map[string]string{
		"interval": queryInterval,
	}), 15*time.Second)
}

func (c *baseClientImpl) getSettings() *simplejson.Json {
	return c.ds.JsonData
}

type multiRequest struct {
	header map[string]interface{}
	body   interface{}
}

func (c *baseClientImpl) executeBatchRequest(uriPath string, requests []*multiRequest) (*http.Response, error) {
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
		payload.WriteString(string(reqBody) + "\n")
	}

	return c.executeRequest(http.MethodPost, uriPath, payload.Bytes())
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

	httpClient, err := c.ds.GetHttpClient()
	if err != nil {
		return nil, err
	}

	if method == http.MethodPost {
		clientLog.Debug("Executing request", "url", req.URL.String(), "method", method)
	} else {
		clientLog.Debug("Executing request", "url", req.URL.String(), "method", method)
	}

	return ctxhttp.Do(c.ctx, httpClient, req)
}

func (c *baseClientImpl) ExecuteMultisearch(r *MultiSearchRequest) (*MultiSearchResponse, error) {
	multiRequests := c.createMultiSearchRequests(r.Requests)
	res, err := c.executeBatchRequest("_msearch", multiRequests)
	if err != nil {
		return nil, err
	}

	var msr MultiSearchResponse
	defer res.Body.Close()
	dec := json.NewDecoder(res.Body)
	err = dec.Decode(&msr)
	if err != nil {
		return nil, err
	}

	clientLog.Debug("Received multisearch response", "code", res.StatusCode, "status", res.Status, "content-length", res.ContentLength)

	msr.status = res.StatusCode

	return &msr, nil
}

func (c *baseClientImpl) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := []*multiRequest{}

	for _, searchReq := range searchRequests {
		multiRequests = append(multiRequests, &multiRequest{
			header: map[string]interface{}{
				"search_type":        "query_then_fetch",
				"ignore_unavailable": true,
				"index":              strings.Join(c.indices, ","),
			},
			body: searchReq,
		})
	}

	return multiRequests
}

type v2Client struct {
	baseClient
}

func newV2Client(bc baseClient) (*v2Client, error) {
	c := v2Client{
		baseClient: bc,
	}

	return &c, nil
}

func (c *v2Client) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := c.baseClient.createMultiSearchRequests(searchRequests)

	for _, mr := range multiRequests {
		mr.header["search_type"] = "count"
	}

	return multiRequests
}

type v5Client struct {
	baseClient
}

func newV5Client(bc baseClient) (*v5Client, error) {
	c := v5Client{
		baseClient: bc,
	}

	return &c, nil
}

type v56Client struct {
	*v5Client
	maxConcurrentShardRequests int
}

func newV56Client(bc baseClient) (*v56Client, error) {
	v5Client := v5Client{
		baseClient: bc,
	}
	maxConcurrentShardRequests := bc.getSettings().Get("maxConcurrentShardRequests").MustInt(256)

	c := v56Client{
		v5Client:                   &v5Client,
		maxConcurrentShardRequests: maxConcurrentShardRequests,
	}

	return &c, nil
}

func (c *v56Client) createMultiSearchRequests(searchRequests []*SearchRequest) []*multiRequest {
	multiRequests := c.v5Client.createMultiSearchRequests(searchRequests)

	for _, mr := range multiRequests {
		mr.header["max_concurrent_shard_requests"] = c.maxConcurrentShardRequests
	}

	return multiRequests
}

func (c *baseClientImpl) MultiSearch() *MultiSearchRequestBuilder {
	return NewMultiSearchRequestBuilder(c.GetVersion())
}
