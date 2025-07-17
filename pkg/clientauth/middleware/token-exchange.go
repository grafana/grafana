package middleware

import (
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	infralog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type TokenExchangeMiddleware struct {
	tokenExchangeClient authlib.TokenExchanger
}

type tokenExchangeMiddlewareImpl struct {
	tokenExchangeClient authlib.TokenExchanger
	audiences           []string
	next                http.RoundTripper
}

type signerSettings struct {
	token            string
	tokenExchangeURL string
}

var _ http.RoundTripper = &tokenExchangeMiddlewareImpl{}

func TestingTokenExchangeMiddleware(tokenExchangeClient authlib.TokenExchanger) *TokenExchangeMiddleware {
	return &TokenExchangeMiddleware{
		tokenExchangeClient: tokenExchangeClient,
	}
}

func NewTokenExchangeMiddleware(cfg *setting.Cfg) (*TokenExchangeMiddleware, error) {
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
	return &TokenExchangeMiddleware{
		tokenExchangeClient: tokenExchangeClient,
	}, nil
}

func (p *TokenExchangeMiddleware) New(audiences []string) sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &tokenExchangeMiddlewareImpl{
			tokenExchangeClient: p.tokenExchangeClient,
			audiences:           audiences,
			next:                next,
		}
	}
}

func (m tokenExchangeMiddlewareImpl) RoundTrip(req *http.Request) (res *http.Response, e error) {
	log := infralog.New("token-exchange-middleware")

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

// we exercise the below code path in OSS but would rather have it fail
// instead of documenting these non-pertinent settings and requiring mock values for them.
// hence, the error return is handled above as non-critical and a mock
// exchange client is returned.
func readSignerSettings(cfg *setting.Cfg) (*signerSettings, error) {
	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	s := &signerSettings{}

	s.token = grpcClientAuthSection.Key("token").MustString("")
	s.tokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")

	if s.token == "" || s.tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return s, nil
}
