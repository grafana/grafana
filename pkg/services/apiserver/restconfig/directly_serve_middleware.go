package restconfig

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

type RedirectViaRestConfigMiddlewareFactory struct {
	provider RestConfigProvider
}

// may be used by backend to rewrite requests to paths now supported under /apis
func NewRedirectViaRestConfigRoundtripper(provider RestConfigProvider) *RedirectViaRestConfigMiddlewareFactory {
	return &RedirectViaRestConfigMiddlewareFactory{
		provider: provider,
	}
}

func (t *RedirectViaRestConfigMiddlewareFactory) New() sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return t
	}
}

func (t *RedirectViaRestConfigMiddlewareFactory) RoundTrip(req *http.Request) (*http.Response, error) {
	config, err := t.provider.GetRestConfig(req.Context())
	if err != nil {
		return nil, err
	}
	return config.Transport.RoundTrip(req)
}
