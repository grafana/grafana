package client

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/promlib/models"
)

type doer interface {
	Do(req *http.Request) (*http.Response, error)
}

var endpointsSupportOnlyGet = []string{
	"api/v1/label/", // label values endpoint api/v1/label/<label-key>/values
	"api/v1/metadata",
	"api/v1/targets",
	"api/v1/rules",
	"api/v1/alerts",
	"api/v1/targets/metadata",
	"api/v1/alertmanagers",
	"api/v1/status/config",
	"api/v1/status/flags",
	"api/v1/status/runtimeinfo",
	"api/v1/status/buildinfo",
	"api/v1/status/tsdb",
	"api/v1/status/walreplay",
	"api/v1/notifications",
}

// Client is a custom Prometheus client. Reason for this is that Prom Go client serializes response into its own
// objects, we have to go through them and then serialize again into DataFrame which isn't very efficient. Using custom
// client we can parse response directly into DataFrame.
type Client struct {
	doer         doer
	method       string
	baseUrl      string
	queryTimeout string
}

func NewClient(d doer, method, baseUrl, queryTimeout string) *Client {
	return &Client{doer: d, method: method, baseUrl: baseUrl, queryTimeout: queryTimeout}
}

func (c *Client) QueryRange(ctx context.Context, q *models.Query) (*http.Response, error) {
	tr := q.TimeRange()
	qv := map[string]string{
		"query": q.Expr,
		"start": formatTime(tr.Start),
		"end":   formatTime(tr.End),
		"step":  strconv.FormatFloat(tr.Step.Seconds(), 'f', -1, 64),
	}
	if c.queryTimeout != "" {
		qv["timeout"] = c.queryTimeout
	}

	req, err := c.createQueryRequest(ctx, "api/v1/query_range", qv)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryInstant(ctx context.Context, q *models.Query) (*http.Response, error) {
	// We do not need a time range here.
	// Instant query evaluates at a single point in time.
	// Using q.TimeRange is aligning the query range to step.
	// Which causes a misleading time point.
	// Instead of aligning we use time point directly.
	// https://prometheus.io/docs/prometheus/latest/querying/api/#instant-queries
	qv := map[string]string{"query": q.Expr, "time": formatTime(q.End)}
	if c.queryTimeout != "" {
		qv["timeout"] = c.queryTimeout
	}
	req, err := c.createQueryRequest(ctx, "api/v1/query", qv)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryExemplars(ctx context.Context, q *models.Query) (*http.Response, error) {
	tr := q.TimeRange()
	qv := map[string]string{
		"query": q.Expr,
		"start": formatTime(tr.Start),
		"end":   formatTime(tr.End),
	}

	req, err := c.createQueryRequest(ctx, "api/v1/query_exemplars", qv)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryResource(ctx context.Context, req *backend.CallResourceRequest) (*http.Response, error) {
	u, err := c.prepareResourceURL(req.URL, req.Path)
	if err != nil {
		return nil, err
	}

	useGet := c.shouldUseGetMethod(req.Path)
	return c.executeResourceQueryWithFallback(ctx, u, req.Body, useGet)
}

func (c *Client) executeResourceQueryWithFallback(ctx context.Context, u *url.URL, body []byte, useGet bool) (*http.Response, error) {
	var httpRequest *http.Request
	var err error

	if useGet {
		addBodyToQueryParams(u, body)
		httpRequest, err = createRequest(ctx, http.MethodGet, u, http.NoBody)
	} else {
		httpRequest, err = createRequest(ctx, http.MethodPost, u, bytes.NewReader(body))
	}

	if err != nil {
		return nil, err
	}

	resp, err := c.doer.Do(httpRequest)
	if resp == nil {
		return nil, err
	}

	// Try GET if POST fails with 405 or 400
	if err == nil && httpRequest.Method == http.MethodPost &&
		(resp.StatusCode == http.StatusMethodNotAllowed || resp.StatusCode == http.StatusBadRequest) {

		if err = resp.Body.Close(); err != nil {
			return nil, err
		}

		addBodyToQueryParams(u, body)
		httpRequest, err = createRequest(ctx, http.MethodGet, u, http.NoBody)
		if err != nil {
			return nil, err
		}

		return c.doer.Do(httpRequest)
	}

	return resp, err
}

func (c *Client) prepareResourceURL(reqURL, reqPath string) (*url.URL, error) {
	reqUrlParsed, err := url.Parse(reqURL)
	if err != nil {
		return nil, err
	}
	u, err := c.createUrl(reqPath, nil)
	if err != nil {
		return nil, err
	}
	u.RawQuery = reqUrlParsed.RawQuery
	return u, nil
}

func (c *Client) shouldUseGetMethod(reqPath string) bool {
	if c.method == http.MethodGet {
		return true
	}

	for _, endpoint := range endpointsSupportOnlyGet {
		if strings.HasPrefix(reqPath, endpoint) {
			return true
		}
	}
	return false
}

// addBodyToQueryParams parses the request body as form data and adds its parameters to the URL query string
func addBodyToQueryParams(u *url.URL, body []byte) {
	if len(body) > 0 {
		// Try to parse the body as form data
		formValues, err := url.ParseQuery(string(body))
		if err == nil && len(formValues) > 0 {
			// Merge query params from URL and body
			queryValues := u.Query()
			for key, values := range formValues {
				for _, value := range values {
					queryValues.Add(key, value)
				}
			}
			u.RawQuery = queryValues.Encode()
		}
	}
}

func (c *Client) createQueryRequest(ctx context.Context, endpoint string, qv map[string]string) (*http.Request, error) {
	if strings.ToUpper(c.method) == http.MethodPost {
		u, err := c.createUrl(endpoint, nil)
		if err != nil {
			return nil, err
		}

		v := make(url.Values)
		for key, val := range qv {
			v.Set(key, val)
		}

		return createRequest(ctx, c.method, u, strings.NewReader(v.Encode()))
	}

	u, err := c.createUrl(endpoint, qv)
	if err != nil {
		return nil, err
	}

	return createRequest(ctx, c.method, u, http.NoBody)
}

func (c *Client) createUrl(endpoint string, qs map[string]string) (*url.URL, error) {
	finalUrl, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	finalUrl.Path = path.Join(finalUrl.Path, endpoint)

	// don't re-encode the Query if not needed
	if len(qs) != 0 {
		urlQuery := finalUrl.Query()

		for key, val := range qs {
			urlQuery.Set(key, val)
		}

		finalUrl.RawQuery = urlQuery.Encode()
	}

	return finalUrl, nil
}

func createRequest(ctx context.Context, method string, u *url.URL, bodyReader io.Reader) (*http.Request, error) {
	request, err := http.NewRequestWithContext(ctx, method, u.String(), bodyReader)
	if err != nil {
		return nil, err
	}

	if strings.ToUpper(method) == http.MethodPost {
		// This may not be true but right now we don't have more information here and seems like we send just this type
		// of encoding right now if it is a POST
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		// This allows transport to retry request. See https://github.com/prometheus/client_golang/pull/1022
		// It's set to nil so it is not actually sent over the wire, just used in Go http lib to retry requests.
		request.Header["Idempotency-Key"] = nil
	}
	return request, nil
}

func formatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}
