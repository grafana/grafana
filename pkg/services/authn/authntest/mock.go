package authntest

import (
	"context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
)

var (
	_ authn.Service              = new(MockService)
	_ authn.IdentitySynchronizer = new(MockService)
)

type MockService struct {
	SyncIdentityFunc         func(ctx context.Context, identity *authn.Identity) error
	RegisterPostAuthHookFunc func(hook authn.PostAuthHookFn, priority uint)
}

func (m *MockService) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	panic("unimplemented")
}

func (m *MockService) IsClientEnabled(name string) bool {
	panic("unimplemented")
}

func (m *MockService) GetClientConfig(name string) (authn.SSOClientConfig, bool) {
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
	if m.RegisterPostAuthHookFunc != nil {
		m.RegisterPostAuthHookFunc(hook, priority)
	}
}

func (m *MockService) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {
	panic("unimplemented")
}

func (m *MockService) RegisterPreLogoutHook(hook authn.PreLogoutHookFn, priority uint) {
	panic("unimplemented")
}

func (*MockService) Logout(_ context.Context, _ identity.Requester, _ *usertoken.UserToken) (*authn.Redirect, error) {
	panic("unimplemented")
}

func (m *MockService) ResolveIdentity(ctx context.Context, orgID int64, typedID string) (*authn.Identity, error) {
	panic("unimplemented")
}

func (m *MockService) SyncIdentity(ctx context.Context, identity *authn.Identity) error {
	if m.SyncIdentityFunc != nil {
		return m.SyncIdentityFunc(ctx, identity)
	}
	return nil
}

var (
	_ authn.HookClient             = new(MockClient)
	_ authn.LogoutClient           = new(MockClient)
	_ authn.ContextAwareClient     = new(MockClient)
	_ authn.IdentityResolverClient = new(MockClient)
)

type MockClient struct {
	NameFunc            func() string
	AuthenticateFunc    func(ctx context.Context, r *authn.Request) (*authn.Identity, error)
	TestFunc            func(ctx context.Context, r *authn.Request) bool
	PriorityFunc        func() uint
	HookFunc            func(ctx context.Context, identity *authn.Identity, r *authn.Request) error
	LogoutFunc          func(ctx context.Context, user identity.Requester) (*authn.Redirect, bool)
	IdentityTypeFunc    func() claims.IdentityType
	ResolveIdentityFunc func(ctx context.Context, orgID int64, typ claims.IdentityType, id string) (*authn.Identity, error)
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

func (m MockClient) IsEnabled() bool {
	return true
}

func (m MockClient) GetConfig() authn.SSOClientConfig {
	return nil
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

func (m *MockClient) Logout(ctx context.Context, user identity.Requester) (*authn.Redirect, bool) {
	if m.LogoutFunc != nil {
		return m.LogoutFunc(ctx, user)
	}
	return nil, false
}

func (m *MockClient) IdentityType() claims.IdentityType {
	if m.IdentityTypeFunc != nil {
		return m.IdentityTypeFunc()
	}
	return claims.TypeEmpty
}

// ResolveIdentity implements authn.IdentityResolverClient.
func (m *MockClient) ResolveIdentity(ctx context.Context, orgID int64, typ claims.IdentityType, id string) (*authn.Identity, error) {
	if m.ResolveIdentityFunc != nil {
		return m.ResolveIdentityFunc(ctx, orgID, typ, id)
	}
	return nil, nil
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
