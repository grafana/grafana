package middleware

import (
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"k8s.io/apiserver/pkg/endpoints/request"

	infralog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type CloudAccessPolicyTokenSignerMiddlewareProvider struct {
	isCloud             bool
	tokenExchangeClient authlib.TokenExchanger
}

type cloudAccessPolicyTokenSignerMiddleware struct {
	isCloud             bool
	tokenExchangeClient authlib.TokenExchanger
	audiences           []string
	next                http.RoundTripper
}

var _ http.RoundTripper = &cloudAccessPolicyTokenSignerMiddleware{}

func ProvideCloudAccessPolicyTokenSignerMiddlewareProvider(tokenExchangeClient authlib.TokenExchanger, cfg *setting.Cfg) *CloudAccessPolicyTokenSignerMiddlewareProvider {
	return &CloudAccessPolicyTokenSignerMiddlewareProvider{
		tokenExchangeClient: tokenExchangeClient,
		isCloud:             cfg.StackID != "",
	}
}

func (p *CloudAccessPolicyTokenSignerMiddlewareProvider) New(audiences []string) sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &cloudAccessPolicyTokenSignerMiddleware{
			tokenExchangeClient: p.tokenExchangeClient,
			isCloud:             p.isCloud,
			audiences:           audiences,
			next:                next,
		}
	}
}

func (m cloudAccessPolicyTokenSignerMiddleware) RoundTrip(req *http.Request) (res *http.Response, e error) {
	log := infralog.New("cloud-access-policy-token-signer-middleware")

	if !m.isCloud {
		// for non-cloud use-case, call next without signing
		return m.next.RoundTrip(req)
	}

	namespace, ok := request.NamespaceFrom(req.Context())
	if !ok {
		return nil, fmt.Errorf("namespace not found in request context")
	}

	if namespace == "" {
		return nil, fmt.Errorf("cluster scoped resources are currently not supported")
	}

	log.Debug("signing request", "url", req.URL.Path, "audience", m.audiences, "namespace", namespace)
	token, err := m.tokenExchangeClient.Exchange(req.Context(), authlib.TokenExchangeRequest{
		Namespace: namespace,
		Audiences: m.audiences,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}
	req.Header.Set("X-Access-Token", "Bearer "+token.Token)
	return m.next.RoundTrip(req)
}
