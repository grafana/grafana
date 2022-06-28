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

type Client struct {
	doer    doer
	method  string
	baseUrl string
}

func NewClient(d doer, method, baseUrl string) *Client {
	return &Client{doer: d, method: method, baseUrl: baseUrl}
}

func (c *Client) QueryRange(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "api/v1/query_range")

	qs := u.Query()
	qs.Set("query", q.Expr)
	tr := q.TimeRange()
	qs.Set("start", formatTime(tr.Start))
	qs.Set("end", formatTime(tr.End))
	qs.Set("step", strconv.FormatFloat(tr.Step.Seconds(), 'f', -1, 64))

	return c.fetch(ctx, c.method, u, qs, nil)
}

func (c *Client) QueryInstant(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "api/v1/query")

	qs := u.Query()
	qs.Set("query", q.Expr)
	tr := q.TimeRange()
	if !tr.End.IsZero() {
		qs.Set("time", formatTime(tr.End))
	}

	return c.fetch(ctx, c.method, u, qs, nil)
}

func (c *Client) QueryExemplars(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "api/v1/query_exemplars")

	qs := u.Query()
	tr := q.TimeRange()
	qs.Set("query", q.Expr)
	qs.Set("start", formatTime(tr.Start))
	qs.Set("end", formatTime(tr.End))

	return c.fetch(ctx, c.method, u, qs, nil)
}

type FetchReq struct {
	Method      string
	Url         *url.URL
	QueryString url.Values
}

func (c *Client) QueryResource(ctx context.Context, req *backend.CallResourceRequest) (*http.Response, error) {
	// The way URL is represented in CallResourceRequest and what we need for the fetch function is different
	// so here we have to do a bit of parsing, so we can then compose it with the base url in correct way.
	baseUrlParsed, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}
	reqUrlParsed, err := url.Parse(req.URL)
	if err != nil {
		return nil, err
	}

	baseUrlParsed.Path = path.Join(baseUrlParsed.Path, req.Path)
	baseUrlParsed.RawQuery = reqUrlParsed.RawQuery

	return c.fetch(ctx, req.Method, baseUrlParsed, nil, req.Body)
}

func (c *Client) fetch(ctx context.Context, method string, u *url.URL, qs url.Values, body []byte) (*http.Response, error) {
	// The qs arg seems to be used in some callers of this method, but you can already pass them in the URL object
	if strings.ToUpper(method) == http.MethodGet && qs != nil {
		u.RawQuery = qs.Encode()
	}
	bodyReader := bytes.NewReader(body)
	request, err := http.NewRequestWithContext(ctx, method, u.String(), bodyReader)
	if err != nil {
		return nil, err
	}

	// This may not be true but right now we don't have more information here and seems like we send just this type
	// of encoding right now if it is a POST
	if strings.ToUpper(method) == http.MethodPost {
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	return c.doer.Do(request)
}

func formatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}
