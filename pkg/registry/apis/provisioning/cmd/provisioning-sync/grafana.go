package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// grafana holds the clients that talk to a running Grafana's /apis endpoints.
type grafana struct {
	restConfig   *rest.Config
	provisioning client.Interface
	clients      resources.ClientFactory
	// apiLister reads a Repository's resources subresource, so it only answers for repositories
	// that exist in Grafana.
	apiLister resources.ResourceLister
}

func newGrafana(opts options) (*grafana, error) {
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

	provisioningClient, err := client.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create provisioning client: %w", err)
	}

	restClientCfg := rest.CopyConfig(cfg)
	restClientCfg.GroupVersion = &schema.GroupVersion{Group: provisioning.GROUP, Version: provisioning.VERSION}
	restClientCfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	restClient, err := rest.RESTClientFor(restClientCfg)
	if err != nil {
		return nil, fmt.Errorf("create provisioning REST client: %w", err)
	}

	g := &grafana{
		restConfig:   cfg,
		provisioning: provisioningClient,
		apiLister:    resources.NewResourceListerFromProvisioningAPI(restClient, 0),
	}
	g.clients = resources.NewClientFactory(g, nil)
	return g, nil
}

func (g *grafana) getRepository(ctx context.Context, namespace, name string) (*provisioning.Repository, error) {
	cfg, err := g.provisioning.ProvisioningV0alpha1().Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get repository %s/%s: %w", namespace, name, err)
	}
	return cfg, nil
}

func (g *grafana) GetRestConfig(context.Context) (*rest.Config, error) {
	return g.restConfig, nil
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
