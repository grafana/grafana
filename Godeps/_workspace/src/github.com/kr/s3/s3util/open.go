package s3util

import (
	"io"
	"net/http"
	"time"
)

// Open requests the S3 object at url. An HTTP status other than 200 is
// considered an error.
//
// If c is nil, Open uses DefaultConfig.
func Open(url string, c *Config) (io.ReadCloser, error) {
	if c == nil {
		c = DefaultConfig
	}
	// TODO(kr): maybe parallel range fetching
	r, _ := http.NewRequest("GET", url, nil)
	r.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	c.Sign(r, *c.Keys)
	client := c.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(r)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, newRespError(resp)
	}
	return resp.Body, nil
}
