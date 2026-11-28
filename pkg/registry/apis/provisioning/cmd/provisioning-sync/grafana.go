package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// newClientFactory builds the clients the job workers use to talk to Grafana's /apis endpoints.
func newClientFactory(opts options) (resources.ClientFactory, error) {
	cfg := &rest.Config{Host: opts.grafanaURL, APIPath: "/apis"}
	switch {
	case opts.tokenExchangeURL != "":
		exchanger, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
			TokenExchangeURL: opts.tokenExchangeURL,
			Token:            opts.exchangeToken,
		})
		if err != nil {
			return nil, fmt.Errorf("create token exchange client: %w", err)
		}
		// One Grafana serves every group the sync writes, so a single token carries all their audiences.
		cfg.WrapTransport = clientauth.NewTokenExchangeTransportWrapper(
			exchanger,
			clientauth.NewStaticAudienceProvider(provisioning.GROUP, resources.DashboardResource.Group, resources.FolderResource.Group),
			clientauth.NewStaticNamespaceProvider(clientauth.WildcardNamespace),
		)
	case opts.accessToken != "":
		cfg.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
			return &accessTokenRoundTripper{token: opts.accessToken, next: rt}
		}
	case opts.grafanaToken != "":
		cfg.BearerToken = opts.grafanaToken
	default:
		cfg.Username = opts.grafanaUser
		cfg.Password = opts.grafanaPassword
	}
	return resources.NewClientFactory(staticRestConfig{cfg}, nil), nil
}

type staticRestConfig struct {
	cfg *rest.Config
}

func (s staticRestConfig) GetRestConfig(context.Context) (*rest.Config, error) {
	return s.cfg, nil
}

// accessTokenRoundTripper sends a pre-minted access token the way the token exchange wrapper does.
type accessTokenRoundTripper struct {
	token string
	next  http.RoundTripper
}

func (t *accessTokenRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Access-Token", "Bearer "+t.token)
	return t.next.RoundTrip(req)
}
