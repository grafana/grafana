package featuremgmt

import (
	"net/http"

	ofrep "github.com/open-feature/go-sdk-contrib/providers/ofrep"
	"github.com/open-feature/go-sdk/openfeature"
)

// contentTypeTransport ensures Content-Type header is set for OFREP requests
type contentTypeTransport struct {
	base http.RoundTripper
}

func (t *contentTypeTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// OFREP requires Content-Type: application/json
	if req.Body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	return t.base.RoundTrip(req)
}

func newOFREPProvider(url string, client *http.Client) (openfeature.FeatureProvider, error) {
	options := []ofrep.Option{}
	if client != nil {
		// Wrap transport to add Content-Type header
		if client.Transport == nil {
			client.Transport = http.DefaultTransport
		}
		client.Transport = &contentTypeTransport{base: client.Transport}
		options = append(options, ofrep.WithClient(client))
	}

	return ofrep.NewProvider(url, options...), nil
}
