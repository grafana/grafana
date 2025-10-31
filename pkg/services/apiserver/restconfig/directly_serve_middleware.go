package restconfig

import (
	"context"
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type reqContextKey = ctxkey.Key

// Copied from contexthandler to prevent a circular dependency because featuremgmt uses this package, and contexthandler uses featuremgmt.
func FromContext(c context.Context) *contextmodel.ReqContext {
	if reqCtx, ok := c.Value(reqContextKey{}).(*contextmodel.ReqContext); ok {
		return reqCtx
	}
	return nil
}

type DirectlyServeMiddlewareFactory struct {
	provider DirectRestConfigProvider
}

// may be used by backend to rewrite requests to paths now supported under /apis
func NewDirectlyServeWithRestConfigRoundtripper(provider DirectRestConfigProvider) *DirectlyServeMiddlewareFactory {
	return &DirectlyServeMiddlewareFactory{
		provider: provider,
	}
}

func (t *DirectlyServeMiddlewareFactory) New() sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return t
	}
}

func (t *DirectlyServeMiddlewareFactory) RoundTrip(req *http.Request) (*http.Response, error) {
	reqCtx := FromContext(req.Context())

	config := t.provider.GetDirectRestConfig(reqCtx)
	return config.Transport.RoundTrip(req)
}
