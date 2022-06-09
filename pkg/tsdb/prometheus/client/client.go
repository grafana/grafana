package client

import (
	"context"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

type Client struct {
	http.RoundTripper
	method  string
	baseUrl string
}

func NewClient(rt http.RoundTripper, method, baseUrl string) *Client {
	return &Client{RoundTripper: rt, method: method, baseUrl: baseUrl}
}

func (c *Client) QueryRange(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.Parse("/api/v1/query_range")
	if err != nil {
		return nil, err
	}

	qs := u.Query()
	qs.Set("query", q.Expr)
	tr := q.TimeRange()
	qs.Set("start", formatTime(tr.Start))
	qs.Set("end", formatTime(tr.End))
	qs.Set("step", strconv.FormatFloat(tr.Step.Seconds(), 'f', -1, 64))

	return c.fetch(ctx, u, qs)
}

func (c *Client) QueryInstant(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.Parse("/api/v1/query")
	if err != nil {
		return nil, err
	}

	qs := u.Query()
	qs.Set("query", q.Expr)
	tr := q.TimeRange()
	if !tr.End.IsZero() {
		qs.Set("time", formatTime(tr.End))
	}

	return c.fetch(ctx, u, qs)
}

func (c *Client) QueryExemplars(ctx context.Context, q *models.Query) (*http.Response, error) {
	u, err := url.Parse("/api/v1/query_exemplars")
	if err != nil {
		return nil, err
	}

	qs := u.Query()
	tr := q.TimeRange()
	qs.Set("query", q.Expr)
	qs.Set("start", formatTime(tr.Start))
	qs.Set("end", formatTime(tr.End))

	return c.fetch(ctx, u, qs)
}

func (c *Client) fetch(ctx context.Context, u *url.URL, qs url.Values) (*http.Response, error) {
	if strings.ToUpper(c.method) == http.MethodGet {
		u.RawQuery = qs.Encode()
	}

	r, err := http.NewRequestWithContext(ctx, c.method, u.String(), nil)
	if err != nil {
		return nil, err
	}

	if strings.ToUpper(c.method) == http.MethodPost {
		r.Body = ioutil.NopCloser(strings.NewReader(qs.Encode()))
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	return c.RoundTrip(r)
}

func (c *Client) RoundTrip(req *http.Request) (*http.Response, error) {
	b, err := url.ParseRequestURI(c.baseUrl)
	if err != nil {
		return nil, err
	}

	req.URL.Scheme = b.Scheme
	req.URL.Host = b.Host
	req.URL.Path = path.Join(b.Path, req.URL.Path)

	return c.RoundTripper.RoundTrip(req)
}

func formatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}
