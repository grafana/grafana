package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type esClient struct {
	baseURL     string
	indexPrefix string
	http        *http.Client
}

func newESClient(addresses []string, indexPrefix string) *esClient {
	base := "http://127.0.0.1:9200"
	if len(addresses) > 0 && addresses[0] != "" {
		base = strings.TrimRight(addresses[0], "/")
	}
	if indexPrefix == "" {
		indexPrefix = "grafana"
	}
	return &esClient{
		baseURL:     base,
		indexPrefix: indexPrefix,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *esClient) indexName(key resourceIndexKey) string {
	parts := []string{
		c.indexPrefix,
		sanitizeESName(key.Namespace),
		sanitizeESName(key.Group),
		sanitizeESName(key.Resource),
	}
	return strings.Join(parts, "-")
}

type resourceIndexKey struct {
	Namespace string
	Group     string
	Resource  string
}

func sanitizeESName(v string) string {
	v = strings.ToLower(v)
	var b strings.Builder
	for _, r := range v {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '.', r == '-', r == '_':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "default"
	}
	return out
}

func (c *esClient) do(ctx context.Context, method, path string, body any) ([]byte, int, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rsp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rsp.Body.Close() }()
	raw, err := io.ReadAll(rsp.Body)
	if err != nil {
		return nil, rsp.StatusCode, err
	}
	if rsp.StatusCode >= 400 {
		return raw, rsp.StatusCode, fmt.Errorf("elasticsearch %s %s: status %d: %s", method, path, rsp.StatusCode, string(raw))
	}
	return raw, rsp.StatusCode, nil
}

func (c *esClient) putMapping(ctx context.Context, index string, mapping map[string]any) error {
	_, _, err := c.do(ctx, http.MethodPut, "/"+index+"/_mapping", mapping)
	return err
}

func esIndexSettings() map[string]any {
	return map[string]any{
		"number_of_shards":   1,
		"number_of_replicas": 0,
		"index": map[string]any{
			"max_result_window": esMaxResultWindow,
		},
	}
}

func (c *esClient) ensureIndex(ctx context.Context, index string) error {
	_, code, err := c.do(ctx, http.MethodHead, "/"+index, nil)
	if err == nil && code == http.StatusOK {
		return c.ensureIndexSettings(ctx, index)
	}
	_, _, err = c.do(ctx, http.MethodPut, "/"+index, map[string]any{
		"settings": esIndexSettings(),
	})
	return err
}

func (c *esClient) ensureIndexSettings(ctx context.Context, index string) error {
	_, _, err := c.do(ctx, http.MethodPut, "/"+index+"/_settings", map[string]any{
		"index": map[string]any{
			"max_result_window": esMaxResultWindow,
		},
	})
	return err
}

func (c *esClient) bulk(ctx context.Context, lines []string, refresh string) error {
	if len(lines) == 0 {
		return nil
	}
	body := strings.Join(lines, "\n") + "\n"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/_bulk?refresh="+refresh, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	rsp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = rsp.Body.Close() }()
	raw, err := io.ReadAll(rsp.Body)
	if err != nil {
		return err
	}
	if rsp.StatusCode >= 400 {
		return fmt.Errorf("elasticsearch bulk: status %d: %s", rsp.StatusCode, string(raw))
	}
	var parsed struct {
		Errors bool `json:"errors"`
	}
	if err := json.Unmarshal(raw, &parsed); err == nil && parsed.Errors {
		return fmt.Errorf("elasticsearch bulk reported errors: %s", string(raw))
	}
	return nil
}

func (c *esClient) search(ctx context.Context, index string, body map[string]any) (map[string]any, error) {
	raw, _, err := c.do(ctx, http.MethodPost, "/"+index+"/_search", body)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *esClient) refresh(ctx context.Context, index string) error {
	_, _, err := c.do(ctx, http.MethodPost, "/"+index+"/_refresh", nil)
	return err
}

func (c *esClient) deleteIndex(ctx context.Context, index string) error {
	_, code, err := c.do(ctx, http.MethodDelete, "/"+index, nil)
	if err != nil && code == http.StatusNotFound {
		return nil
	}
	return err
}

func (c *esClient) count(ctx context.Context, index string, body map[string]any) (int64, error) {
	raw, _, err := c.do(ctx, http.MethodPost, "/"+index+"/_count", body)
	if err != nil {
		return 0, err
	}
	var parsed struct {
		Count int64 `json:"count"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return 0, err
	}
	return parsed.Count, nil
}
