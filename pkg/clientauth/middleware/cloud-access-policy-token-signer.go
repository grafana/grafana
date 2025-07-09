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
	tokenExchangeClient authlib.TokenExchanger
}

type cloudAccessPolicyTokenSignerMiddleware struct {
	tokenExchangeClient authlib.TokenExchanger
	audiences           []string
	next                http.RoundTripper
}

type signerSettings struct {
	token            string
	tokenExchangeURL string
}

var _ http.RoundTripper = &cloudAccessPolicyTokenSignerMiddleware{}

func ProvideCloudAccessPolicyTokenSignerMiddlewareProvider(cfg *setting.Cfg) (*CloudAccessPolicyTokenSignerMiddlewareProvider, error) {
	clientCfg, err := readSignerSettings(cfg)
	if err != nil {
		return nil, err
	}

	tokenExchangeClient, err := authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
		Token:            clientCfg.token,
		TokenExchangeURL: clientCfg.tokenExchangeURL,
	})
	if err != nil {
		return nil, err
	}
	return &CloudAccessPolicyTokenSignerMiddlewareProvider{
		tokenExchangeClient: tokenExchangeClient,
	}, nil
}

func (p *CloudAccessPolicyTokenSignerMiddlewareProvider) New(audiences []string) sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &cloudAccessPolicyTokenSignerMiddleware{
			tokenExchangeClient: p.tokenExchangeClient,
			audiences:           audiences,
			next:                next,
		}
	}
}

func (m cloudAccessPolicyTokenSignerMiddleware) RoundTrip(req *http.Request) (res *http.Response, e error) {
	log := infralog.New("cloud-access-policy-token-signer-middleware")

	user, err := identity.GetRequester(req.Context())
	if err != nil {
		return nil, err
	}

	namespace := user.GetNamespace()

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

func readSignerSettings(cfg *setting.Cfg) (*signerSettings, error) {
	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	s := &signerSettings{}

	s.token = grpcClientAuthSection.Key("token").MustString("")
	s.tokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")

	// When running in cloud mode, the token and tokenExchangeURL are required.
	if s.token == "" || s.tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return s, nil
}
