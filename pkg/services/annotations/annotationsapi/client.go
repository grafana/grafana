package annotationsapi

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const annotationServerAudience = "annotation.grafana.app"

// newClient returns nil when APIServerURL is empty (proxy disabled).
func newClient(cfg *setting.Cfg, userSvc user.Service) (client.K8sHandler, error) {
	url := strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL)
	if url == "" {
		return nil, nil
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := strings.TrimSpace(grpcSection.Key("token").MustString(""))
	tokenExchangeURL := strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString(""))

	if token == "" || tokenExchangeURL == "" {
		return nil, fmt.Errorf("annotation proxy: grpc_client_authentication token and token_exchange_url are required when api_server_url is set")
	}

	restCfg, err := buildRESTConfig(url, token, tokenExchangeURL, cfg.Env == setting.Dev)
	if err != nil {
		return nil, err
	}

	return client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		annotationV0.AnnotationKind().GroupVersionResource(),
		func(_ context.Context) (*rest.Config, error) { return restCfg, nil },
		userSvc,
		nil,
	), nil
}

func buildRESTConfig(url, token, tokenExchangeURL string, allowInsecure bool) (*rest.Config, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if allowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
			}},
		))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("annotation proxy: creating token exchange client: %w", err)
	}

	return &rest.Config{
		Host:          url,
		WrapTransport: newBearerTokenExchangeWrapper(tc),
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: allowInsecure,
		},
	}, nil
}

type bearerTokenExchangeRT struct {
	exchanger authnlib.TokenExchanger
	next      http.RoundTripper
}

func (rt *bearerTokenExchangeRT) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := rt.exchanger.Exchange(req.Context(), authnlib.TokenExchangeRequest{
		Audiences: []string{annotationServerAudience},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("exchanging token: %w", err)
	}
	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Access-Token", resp.Token)
	return rt.next.RoundTrip(req)
}

func newBearerTokenExchangeWrapper(exchanger authnlib.TokenExchanger) func(http.RoundTripper) http.RoundTripper {
	return func(rt http.RoundTripper) http.RoundTripper {
		return &bearerTokenExchangeRT{exchanger: exchanger, next: rt}
	}
}
