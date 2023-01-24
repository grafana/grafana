package historian

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultClientTimeout = 30 * time.Second

type LokiConfig struct {
	ReadPathURL       *url.URL
	WritePathURL      *url.URL
	BasicAuthUser     string
	BasicAuthPassword string
	TenantID          string
	ExternalLabels    map[string]string
}

func NewLokiConfig(cfg setting.UnifiedAlertingStateHistorySettings) (LokiConfig, error) {
	read, write := cfg.LokiReadURL, cfg.LokiWriteURL
	if read == "" {
		read = cfg.LokiRemoteURL
	}
	if write == "" {
		write = cfg.LokiRemoteURL
	}

	readURL, err := url.Parse(read)
	if err != nil {
		return LokiConfig{}, fmt.Errorf("failed to parse loki remote read URL: %w", err)
	}
	writeURL, err := url.Parse(write)
	if err != nil {
		return LokiConfig{}, fmt.Errorf("failed to parse loki remote write URL: %w", err)
	}

	return LokiConfig{
		ReadPathURL:       readURL,
		WritePathURL:      writeURL,
		BasicAuthUser:     cfg.LokiBasicAuthUsername,
		BasicAuthPassword: cfg.LokiBasicAuthPassword,
		TenantID:          cfg.LokiTenantID,
	}, nil
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

func (c *httpLokiClient) ping(ctx context.Context) error {
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
		fmt.Sprintf("%d", r.At.UnixNano()), r.Val,
	})
}

func (c *httpLokiClient) push(ctx context.Context, s []stream) error {
	body := struct {
		Streams []stream `json:"streams"`
	}{Streams: s}
	enc, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to serialize Loki payload: %w", err)
	}

	uri := c.cfg.WritePathURL.JoinPath("/loki/api/v1/push")
	req, err := http.NewRequest(http.MethodPost, uri.String(), bytes.NewBuffer(enc))
	if err != nil {
		return fmt.Errorf("failed to create Loki request: %w", err)
	}

	c.setAuthAndTenantHeaders(req)
	req.Header.Add("content-type", "application/json")

	req = req.WithContext(ctx)
	resp, err := c.client.Do(req)
	if resp != nil {
		defer func() {
			if err := resp.Body.Close(); err != nil {
				c.log.Warn("Failed to close response body", "err", err)
			}
		}()
	}
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		byt, _ := io.ReadAll(resp.Body)
		if len(byt) > 0 {
			c.log.Error("Error response from Loki", "response", string(byt), "status", resp.StatusCode)
		} else {
			c.log.Error("Error response from Loki with an empty body", "status", resp.StatusCode)
		}
		return fmt.Errorf("received a non-200 response from loki, status: %d", resp.StatusCode)
	}
	return nil
}

func (c *httpLokiClient) setAuthAndTenantHeaders(req *http.Request) {
	if c.cfg.BasicAuthUser != "" || c.cfg.BasicAuthPassword != "" {
		req.SetBasicAuth(c.cfg.BasicAuthUser, c.cfg.BasicAuthPassword)
	}

	if c.cfg.TenantID != "" {
		req.Header.Add("X-Scope-OrgID", c.cfg.TenantID)
	}
}
func (c *httpLokiClient) query(ctx context.Context, selectors [][3]string, start, end int64) (QueryRes, error) {
	// Run the pre-flight checks for the query.
	if len(selectors) == 0 {
		return QueryRes{}, fmt.Errorf("at least one selector required to query")
	}
	if start > end {
		return QueryRes{}, fmt.Errorf("start time cannot be after end time")
	}

	query, err := selectorString(selectors)
	if err != nil {
		return QueryRes{}, fmt.Errorf("failed to build loki selector string: %w", err)
	}

	values := url.Values{}
	values.Set("query", query)
	values.Set("start", fmt.Sprintf("%d", start))
	values.Set("end", fmt.Sprintf("%d", end))

	encodedValues := values.Encode()

	req, err := http.NewRequest(http.MethodGet,
		c.cfg.ReadPathURL.JoinPath("/loki/api/v1/query_range?"+encodedValues).String(),
		strings.NewReader(encodedValues))
	if err != nil {
		return QueryRes{}, fmt.Errorf("error creating request: %w", err)
	}

	req = req.WithContext(ctx)
	c.setAuthAndTenantHeaders(req)

	client := http.Client{
		Timeout: time.Second * 30,
	}

	res, err := client.Do(req)
	if err != nil {
		return QueryRes{}, fmt.Errorf("error executing request: %w", err)
	}

	data, err := io.ReadAll(res.Body)
	if err != nil {
		return QueryRes{}, fmt.Errorf("error reading request response: %w", err)
	}

	queryRes := QueryRes{}
	err = json.Unmarshal(data, &queryRes)
	if err != nil {
		fmt.Println(string(data))
		return QueryRes{}, fmt.Errorf("error parsing request response: %w", err)
	}

	return queryRes, nil
}

func selectorString(selectors [][3]string) (string, error) {
	if len(selectors) == 0 {
		return "{}", nil
	}
	// Build the query selector.
	query := ""
	for _, s := range selectors {
		if !isValidOperator(s[1]) {
			return "", fmt.Errorf("'%s' is not a valid query operator", s[1])
		}
		query += fmt.Sprintf("%s%s%q,", s[0], s[1], s[2])
	}
	// Remove the last comma, as we append one to every selector.
	query = query[:len(query)-1]
	return "{" + query + "}", nil

}

func isValidOperator(op string) bool {
	switch op {
	case "=", "!=", "=~", "!~":
		return true
	}
	return false
}

type Stream struct {
	Stream map[string]string `json:"stream"`
	Values [][2]string       `json:"values"`
}

type QueryRes struct {
	Status string    `json:"status"`
	Data   QueryData `json:"data"`
}

type QueryData struct {
	Result []Stream `json:"result"`
}
