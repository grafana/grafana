package historian

import (
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
