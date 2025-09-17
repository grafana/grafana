package auth

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// PropagatedContextRoundTripper propagates the context to the outgoing requests
// it is useful for loopback requests that don't want to use service identity and instead
// scope any emergent actions from incoming API route that happen at the same apiserver
// to the same incoming actor
type PropagatedContextRoundTripper struct {
	transport   http.RoundTripper
	incomingCtx context.Context
}

func NewPropagatedContextRoundTripper(transport http.RoundTripper, incomingCtx context.Context) *PropagatedContextRoundTripper {
	return &PropagatedContextRoundTripper{transport: transport, incomingCtx: incomingCtx}
}

func (t *PropagatedContextRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	id, err := identity.GetRequester(t.incomingCtx)
	if err != nil {
		return nil, err
	}

	ctx := identity.WithRequester(req.Context(), id)
	req = req.WithContext(ctx)
	return t.transport.RoundTrip(req)
}
