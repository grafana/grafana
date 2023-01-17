package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = new(MockClient)

type MockClient struct {
	AuthenticateFunc func(ctx context.Context, r *authn.Request) (*authn.Identity, error)
	TestFunc         func(ctx context.Context, r *authn.Request) bool
}

func (m MockClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if m.AuthenticateFunc != nil {
		return m.AuthenticateFunc(ctx, r)
	}
	return nil, nil
}

func (m MockClient) Test(ctx context.Context, r *authn.Request) bool {
	if m.TestFunc != nil {
		return m.TestFunc(ctx, r)
	}
	return false
}

var _ authn.ProxyClient = new(MockProxyClient)

type MockProxyClient struct {
	AuthenticateProxyFunc func(ctx context.Context, r *authn.Request, username string, additional map[string]string) (*authn.Identity, error)
}

func (m MockProxyClient) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, additional map[string]string) (*authn.Identity, error) {
	if m.AuthenticateProxyFunc != nil {
		return m.AuthenticateProxyFunc(ctx, r, username, additional)
	}
	return nil, nil
}
