package resource

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
)

// LocalManifestDiscovery is an http.RoundTripper that serves the router's
// /apis/discovery tree in-process, so storage running inside Grafana reads the
// same manifests a remote client would, without a listener or token exchange.
// The router depends on the resource client, so it supplies its handler after
// construction via Set; requests wait until then.
type LocalManifestDiscovery struct {
	ready chan struct{}
	once  sync.Once
	serve func(*http.Request) (*http.Response, error)
}

func ProvideLocalManifestDiscovery() *LocalManifestDiscovery {
	return &LocalManifestDiscovery{ready: make(chan struct{})}
}

// Set supplies the handler for the /apis/discovery tree. Later calls are ignored.
func (d *LocalManifestDiscovery) Set(handler http.Handler) {
	d.once.Do(func() {
		d.serve = responsewriter.WrapHandler(handler)
		close(d.ready)
	})
}

// RoundTrip serves req as the Grafana service identity, which the router
// accepts in place of an access token.
func (d *LocalManifestDiscovery) RoundTrip(req *http.Request) (*http.Response, error) {
	select {
	case <-d.ready:
	case <-req.Context().Done():
		return nil, fmt.Errorf("waiting for the router's manifest discovery: %w", req.Context().Err())
	}
	return d.serve(req.WithContext(identity.WithServiceIdentityContext(req.Context(), 0)))
}
