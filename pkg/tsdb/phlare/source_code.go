package phlare

import (
	"context"
	"io"
	"net/http"
	"net/url"
)

type sourceCodeClient struct {
	client  *http.Client
	baseURL string
}

func (c *sourceCodeClient) GetSourceCode(ctx context.Context, values url.Values) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL, nil)
	if err != nil {
		return nil, err
	}

	req.URL.RawQuery = values.Encode()

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}
