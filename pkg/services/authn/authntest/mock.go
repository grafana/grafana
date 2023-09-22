package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Service = new(MockService)
var _ authn.IdentitySynchronizer = new(MockService)

type MockService struct {
	SyncIdentityFunc func(ctx context.Context, identity *authn.Identity) error
}

func (m *MockService) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	panic("unimplemented")
}

func (m *MockService) Login(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	panic("unimplemented")
}

func (m *MockService) RedirectURL(ctx context.Context, client string, r *authn.Request) (*authn.Redirect, error) {
	panic("unimplemented")
}

func (m *MockService) RegisterClient(c authn.Client) {
	panic("unimplemented")
}

func (m *MockService) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {
	panic("unimplemented")
}

func (m *MockService) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {
	panic("unimplemented")
}

func (m *MockService) SyncIdentity(ctx context.Context, identity *authn.Identity) error {
	if m.SyncIdentityFunc != nil {
		return m.SyncIdentityFunc(ctx, identity)
	}
	return nil
}

var _ authn.HookClient = new(MockClient)
var _ authn.ContextAwareClient = new(MockClient)

type MockClient struct {
	NameFunc         func() string
	AuthenticateFunc func(ctx context.Context, r *authn.Request) (*authn.Identity, error)
	TestFunc         func(ctx context.Context, r *authn.Request) bool
	PriorityFunc     func() uint
	HookFunc         func(ctx context.Context, identity *authn.Identity, r *authn.Request) error
}

func (m MockClient) Name() string {
	if m.NameFunc != nil {
		return m.NameFunc()
	}
	return ""
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

func (m MockClient) Priority() uint {
	if m.PriorityFunc != nil {
		return m.PriorityFunc()
	}
	return 0
}

func (m MockClient) Hook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if m.HookFunc != nil {
		return m.HookFunc(ctx, identity, r)
	}
	return nil
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
