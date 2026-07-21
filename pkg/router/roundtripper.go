package router

import (
	"io"
	"net/http"
)

// NoopRoundTripper implements http.RoundTripper to return a dummy response.
type noopRoundTripper struct{}

func (n *noopRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(nil), // Empty body
	}, nil
}
