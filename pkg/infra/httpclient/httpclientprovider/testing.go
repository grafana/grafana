package httpclientprovider

import (
	"bytes"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

type testContext struct {
	callChain []string
}

func (c *testContext) createRoundTripper(name string) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		c.callChain = append(c.callChain, name)
		return &http.Response{
			StatusCode: http.StatusOK,
			Request:    req,
			Body:       io.NopCloser(bytes.NewBufferString("")),
		}, nil
	})
}
