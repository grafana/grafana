package historian

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

const defaultClientTimeout = 30 * time.Second

type LokiConfig struct {
	Url               *url.URL
	BasicAuthUser     string
	BasicAuthPassword string
	TenantID          string
}

type httpLokiClient struct {
	client http.Client
	cfg    LokiConfig
	log    log.Logger
}

func newLokiClient(cfg LokiConfig, logger log.Logger) *httpLokiClient {
	return &httpLokiClient{
		client: http.Client{
			Timeout: defaultClientTimeout,
		},
		cfg: cfg,
		log: logger.New("protocol", "http"),
	}
}

func (c *httpLokiClient) ping() error {
	uri := c.cfg.Url.JoinPath("/loki/api/v1/labels")
	req, err := http.NewRequest(http.MethodGet, uri.String(), nil)

	if c.cfg.BasicAuthUser != "" || c.cfg.BasicAuthPassword != "" {
		req.SetBasicAuth(c.cfg.BasicAuthUser, c.cfg.BasicAuthPassword)
	}

	if c.cfg.TenantID != "" {
		req.Header.Add("X-Scope-OrgID", c.cfg.TenantID)
	}

	if err != nil {
		return fmt.Errorf("error creating request: %w", err)
	}

	res, err := c.client.Do(req)
	if res != nil {
		defer func() {
			if err := res.Body.Close(); err != nil {
				c.log.Warn("Failed to close response body", "err", err)
			}
		}()
	}
	if err != nil {
		return fmt.Errorf("error sending request: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("ping request to loki endpoint returned a non-200 status code: %d", res.StatusCode)
	}
	c.log.Debug("Ping request to Loki endpoint succeeded", "status", res.StatusCode)
	return nil
}

type stream struct {
	Stream map[string]string `json:"stream"`
	Values []row             `json:"values"`
}

type row struct {
	At  time.Time
	Val string
}

func (r *row) MarshalJSON() ([]byte, error) {
	return json.Marshal([2]string{
		fmt.Sprintf("%d", r.At.Unix()), r.Val,
	})
}

func (c *httpLokiClient) push(s []stream) error {
	body := struct {
		Streams []stream `json:"streams"`
	}{Streams: s}
	enc, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to serialize Loki payload: %w", err)
	}

	uri := c.url.JoinPath("/loki/api/v1/push")
	req, err := http.NewRequest(http.MethodPost, uri.String(), bytes.NewBuffer(enc))
	if err != nil {
		return fmt.Errorf("failed to create Loki request: %w", err)
	}

	req.Header.Add("content-type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// TODO: log body if error?
		return fmt.Errorf("received an error response from loki, status: %d", resp.StatusCode)
	}
	return nil
}
