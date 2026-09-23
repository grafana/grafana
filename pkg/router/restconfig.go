package router

import (
	"context"
	"net/http"

	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
)

// NewLoopbackRestConfigProvider lets standalone storage look up folders through
// the router without waiting for an embedded API server to start.
func NewLoopbackRestConfigProvider(handler http.Handler) restcfg.RestConfigProvider {
	return &loopbackRestConfigProvider{handler: handler}
}

type loopbackRestConfigProvider struct {
	handler http.Handler
}

func (p *loopbackRestConfigProvider) GetRestConfig(context.Context) (*clientrest.Config, error) {
	// Host is a placeholder - requests forward directly to the provided handler.
	// Folder checks share this client; the default 5 QPS limiter can exhaust write deadlines.
	return &clientrest.Config{Host: "http://router", Transport: p, QPS: -1}, nil
}

func (p *loopbackRestConfigProvider) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	requester, err := identity.GetRequester(req.Context())
	if err != nil {
		return nil, err
	}
	req = req.Clone(req.Context())
	// Forwarded backends authenticate headers; local handlers also retain the
	// requester through WrapHandler. Read credentials per request, never per client.
	if token := requester.GetAccessToken(); token != "" {
		req.Header.Set("X-Access-Token", "Bearer "+token)
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if token := requester.GetIDToken(); token != "" {
		req.Header.Set("X-Grafana-Id", token)
	}
	return responsewriter.WrapHandler(p.handler)(req)
}
