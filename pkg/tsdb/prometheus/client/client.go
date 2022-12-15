package client

import (
	"bytes"
	"context"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

type doer interface {
	Do(req *http.Request) (*http.Response, error)
}

// Client is a custom Prometheus client. Reason for this is that Prom Go client serializes response into its own
// objects, we have to go through them and then serialize again into DataFrame which isn't very efficient. Using custom
// client we can parse response directly into DataFrame.
type Client struct {
	doer    doer
	method  string
	baseUrl string
}

func NewClient(d doer, method, baseUrl string) *Client {
	return &Client{doer: d, method: method, baseUrl: baseUrl}
}

func (c *Client) QueryRange(ctx context.Context, q *models.Query) (*http.Response, error) {
	tr := q.TimeRange()
	u, err := c.createUrl("api/v1/query_range", map[string]string{
		"query": q.Expr,
		"start": formatTime(tr.Start),
		"end":   formatTime(tr.End),
		"step":  strconv.FormatFloat(tr.Step.Seconds(), 'f', -1, 64),
	})
	if err != nil {
		return nil, err
	}
	req, err := createRequest(ctx, c.method, u, nil)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryInstant(ctx context.Context, q *models.Query) (*http.Response, error) {
	qs := map[string]string{"query": q.Expr}
	tr := q.TimeRange()
	if !tr.End.IsZero() {
		qs["time"] = formatTime(tr.End)
	}

	u, err := c.createUrl("api/v1/query", qs)
	if err != nil {
		return nil, err
	}
	req, err := createRequest(ctx, c.method, u, nil)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryExemplars(ctx context.Context, q *models.Query) (*http.Response, error) {
	tr := q.TimeRange()
	u, err := c.createUrl("api/v1/query_exemplars", map[string]string{
		"query": q.Expr,
		"start": formatTime(tr.Start),
		"end":   formatTime(tr.End),
	})
	if err != nil {
		return nil, err
	}

	req, err := createRequest(ctx, c.method, u, nil)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(req)
}

func (c *Client) QueryResource(ctx context.Context, req *backend.CallResourceRequest) (*http.Response, error) {
	// The way URL is represented in CallResourceRequest and what we need for the fetch function is different
	// so here we have to do a bit of parsing, so we can then compose it with the base url in correct way.
	reqUrlParsed, err := url.Parse(req.URL)
	if err != nil {
		return nil, err
	}
	u, err := c.createUrl(req.Path, nil)
	if err != nil {
		return nil, err
	}
	u.RawQuery = reqUrlParsed.RawQuery

	// We use method from the request, as for resources front end may do a fallback to GET if POST does not work
	// nad we want to respect that.
	httpRequest, err := createRequest(ctx, req.Method, u, req.Body)
	if err != nil {
		return nil, err
	}

	return c.doer.Do(httpRequest)
}

func (c *Client) createUrl(endpoint string, qs map[string]string) (*url.URL, error) {
	finalUrl, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	finalUrl.Path = path.Join(finalUrl.Path, endpoint)
	urlQuery := finalUrl.Query()

	for key, val := range qs {
		urlQuery.Set(key, val)
	}

	finalUrl.RawQuery = urlQuery.Encode()
	return finalUrl, nil
}

func createRequest(ctx context.Context, method string, u *url.URL, body []byte) (*http.Request, error) {
	bodyReader := bytes.NewReader(body)
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
