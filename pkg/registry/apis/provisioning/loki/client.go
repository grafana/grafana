package loki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

type Config struct {
	ReadPathURL       *url.URL
	WritePathURL      *url.URL
	BasicAuthUser     string
	BasicAuthPassword string
	TenantID          string
	ExternalLabels    map[string]string
	MaxQuerySize      int
}

type Stream struct {
	Stream map[string]string `json:"stream"`
	Values []Sample          `json:"values"`
}

type Sample struct {
	T time.Time
	V string
}

func (r Sample) MarshalJSON() ([]byte, error) {
	return json.Marshal([2]string{
		fmt.Sprintf("%d", r.T.UnixNano()), r.V,
	})
}

func (r *Sample) UnmarshalJSON(b []byte) error {
	var tuple [2]string
	if err := json.Unmarshal(b, &tuple); err != nil {
		return fmt.Errorf("failed to deserialize sample in Loki response: %w", err)
	}
	nano, err := strconv.ParseInt(tuple[0], 10, 64)
	if err != nil {
		return fmt.Errorf("timestamp in Loki sample not convertible to nanosecond epoch: %v", tuple[0])
	}
	r.T = time.Unix(0, nano)
	r.V = tuple[1]
	return nil
}

type QueryRes struct {
	Data QueryData `json:"data"`
}

type QueryData struct {
	Result []Stream `json:"result"`
}

type PushRequest struct {
	Streams []Stream `json:"streams"`
}

type Client struct {
	cfg    Config
	client *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Ping(ctx context.Context) error {
	log := logging.FromContext(ctx)
	uri := c.cfg.ReadPathURL.JoinPath("/loki/api/v1/labels")
	req, err := http.NewRequest(http.MethodGet, uri.String(), nil)
	if err != nil {
		return fmt.Errorf("error creating request: %w", err)
	}
	c.setAuthAndTenantHeaders(req)

	req = req.WithContext(ctx)
	res, err := c.client.Do(req)
	if res != nil {
		defer func() {
			if err := res.Body.Close(); err != nil {
				log.Warn("Failed to close response body", "err", err)
			}
		}()
	}
	if err != nil {
		return fmt.Errorf("error sending request: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("ping request to loki endpoint returned a non-200 status code: %d", res.StatusCode)
	}
	log.Debug("Ping request to Loki endpoint succeeded", "status", res.StatusCode)
	return nil
}

func (c *Client) Push(ctx context.Context, streams []Stream) error {
	log := logging.FromContext(ctx)

	pushReq := PushRequest{Streams: streams}
	body, err := json.Marshal(pushReq)
	if err != nil {
		return fmt.Errorf("failed to marshal push request: %w", err)
	}

	uri := c.cfg.WritePathURL.JoinPath("/loki/api/v1/push")
	req, err := http.NewRequest(http.MethodPost, uri.String(), bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create Loki request: %w", err)
	}

	c.setAuthAndTenantHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	req = req.WithContext(ctx)
	res, err := c.client.Do(req)
	if res != nil {
		defer func() {
			if err := res.Body.Close(); err != nil {
				log.Warn("Failed to close response body", "err", err)
			}
		}()
	}
	if err != nil {
		return fmt.Errorf("error sending request: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		log.Error("Error response from Loki", "response", string(body), "status", res.StatusCode)
		return fmt.Errorf("received a non-200 response from loki, status: %d", res.StatusCode)
	}

	log.Debug("Successfully pushed streams to Loki", "status", res.StatusCode, "streams", len(streams))
	return nil
}

func (c *Client) RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (QueryRes, error) {
	log := logging.FromContext(ctx)

	uri := c.cfg.ReadPathURL.JoinPath("/loki/api/v1/query_range")
	req, err := http.NewRequest(http.MethodGet, uri.String(), nil)
	if err != nil {
		return QueryRes{}, fmt.Errorf("error creating request: %w", err)
	}

	q := req.URL.Query()
	q.Set("query", logQL)
	q.Set("start", strconv.FormatInt(start, 10))
	q.Set("end", strconv.FormatInt(end, 10))
	if limit > 0 {
		q.Set("limit", strconv.FormatInt(limit, 10))
	}
	req.URL.RawQuery = q.Encode()

	c.setAuthAndTenantHeaders(req)
	req = req.WithContext(ctx)

	res, err := c.client.Do(req)
	if res != nil {
		defer func() {
			if err := res.Body.Close(); err != nil {
				log.Warn("Failed to close response body", "err", err)
			}
		}()
	}
	if err != nil {
		return QueryRes{}, fmt.Errorf("error sending request: %w", err)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return QueryRes{}, fmt.Errorf("error reading request response: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if len(body) > 0 {
			log.Error("Error response from Loki", "response", string(body), "status", res.StatusCode)
		} else {
			log.Error("Error response from Loki with an empty body", "status", res.StatusCode)
		}
		return QueryRes{}, fmt.Errorf("received a non-200 response from loki, status: %d", res.StatusCode)
	}

	var queryRes QueryRes
	if err := json.Unmarshal(body, &queryRes); err != nil {
		return QueryRes{}, fmt.Errorf("error unmarshaling loki response: %w", err)
	}

	log.Debug("Successfully queried Loki", "status", res.StatusCode, "streams", len(queryRes.Data.Result))
	return queryRes, nil
}

func (c *Client) MaxQuerySize() int {
	return c.cfg.MaxQuerySize
}

func (c *Client) setAuthAndTenantHeaders(req *http.Request) {
	if c.cfg.BasicAuthUser != "" || c.cfg.BasicAuthPassword != "" {
		req.SetBasicAuth(c.cfg.BasicAuthUser, c.cfg.BasicAuthPassword)
	}
	if c.cfg.TenantID != "" {
		req.Header.Set("X-Scope-OrgID", c.cfg.TenantID)
	}
}
