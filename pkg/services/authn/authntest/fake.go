package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.SSOClientConfig = new(FakeSSOClientConfig)

type FakeSSOClientConfig struct {
	ExpectedName                             string
	ExpectedIsAutoLoginEnabled               bool
	ExpectedIsSingleLogoutEnabled            bool
	ExpectedIsSkipOrgRoleSyncEnabled         bool
	ExpectedIsAllowAssignGrafanaAdminEnabled bool
}

func (f *FakeSSOClientConfig) GetDisplayName() string {
	return f.ExpectedName
}

func (f *FakeSSOClientConfig) IsAutoLoginEnabled() bool {
	return f.ExpectedIsAutoLoginEnabled
}

func (f *FakeSSOClientConfig) IsSingleLogoutEnabled() bool {
	return f.ExpectedIsSingleLogoutEnabled
}

func (f *FakeSSOClientConfig) IsSkipOrgRoleSyncEnabled() bool {
	return f.ExpectedIsSkipOrgRoleSyncEnabled
}

func (f *FakeSSOClientConfig) IsAllowAssignGrafanaAdminEnabled() bool {
	return f.ExpectedIsAllowAssignGrafanaAdminEnabled
}

var (
	_ authn.Service              = new(FakeService)
	_ authn.IdentitySynchronizer = new(FakeService)
)

type FakeService struct {
	ExpectedClientConfig authn.SSOClientConfig
	ExpectedErr          error
	ExpectedRedirect     *authn.Redirect
	ExpectedIdentity     *authn.Identity
	ExpectedErrs         []error
	ExpectedIdentities   []*authn.Identity
	CurrentIndex         int
	EnabledClients       []string
}

func (f *FakeService) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if f.ExpectedIdentities != nil {
		if f.CurrentIndex >= len(f.ExpectedIdentities) {
			panic("ExpectedIdentities is empty")
		}
		if f.CurrentIndex >= len(f.ExpectedErrs) {
			panic("ExpectedErrs is empty")
		}

		identity := f.ExpectedIdentities[f.CurrentIndex]
		err := f.ExpectedErrs[f.CurrentIndex]

		f.CurrentIndex += 1

		return identity, err
	}

	return f.ExpectedIdentity, f.ExpectedErr
}

func (f *FakeService) IsClientEnabled(name string) bool {
	// Consider all clients as enabled if EnabledClients is not explicitly set
	if f.EnabledClients == nil {
		return true
	}
	// Check if client is in the list of enabled clients
	for _, s := range f.EnabledClients {
		if s == name {
			return true
		}
	}
	return false
}

func (f *FakeService) GetClientConfig(name string) (authn.SSOClientConfig, bool) {
	if f.ExpectedClientConfig == nil {
		return nil, false
	}
	return f.ExpectedClientConfig, true
}

func (f *FakeService) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {}

func (f *FakeService) RegisterPreLogoutHook(hook authn.PreLogoutHookFn, priority uint) {}

func (f *FakeService) Login(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	if f.ExpectedIdentities != nil {
		if f.CurrentIndex >= len(f.ExpectedIdentities) {
			panic("ExpectedIdentities is empty")
		}
		if f.CurrentIndex >= len(f.ExpectedErrs) {
			panic("ExpectedErrs is empty")
		}

		identity := f.ExpectedIdentities[f.CurrentIndex]
		err := f.ExpectedErrs[f.CurrentIndex]

		f.CurrentIndex += 1

		return identity, err
	}

	return f.ExpectedIdentity, f.ExpectedErr
}

func (f *FakeService) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {}

func (f *FakeService) RedirectURL(ctx context.Context, client string, r *authn.Request) (*authn.Redirect, error) {
	return f.ExpectedRedirect, f.ExpectedErr
}

func (f *FakeService) Logout(_ context.Context, _ identity.Requester, _ *usertoken.UserToken) (*authn.Redirect, error) {
	panic("unimplemented")
}

func (f *FakeService) ResolveIdentity(ctx context.Context, orgID int64, typedID string) (*authn.Identity, error) {
	if f.ExpectedIdentities != nil {
		if f.CurrentIndex >= len(f.ExpectedIdentities) {
			panic("ExpectedIdentities is empty")
		}
		if f.CurrentIndex >= len(f.ExpectedErrs) {
			panic("ExpectedErrs is empty")
		}

		identity := f.ExpectedIdentities[f.CurrentIndex]
		err := f.ExpectedErrs[f.CurrentIndex]

		f.CurrentIndex += 1

		return identity, err
	}

	identity := f.ExpectedIdentity
	identity.OrgID = orgID
	return identity, f.ExpectedErr
}

func (f *FakeService) RegisterClient(c authn.Client) {}

func (f *FakeService) SyncIdentity(ctx context.Context, identity *authn.Identity) error {
	return f.ExpectedErr
}

var _ authn.ContextAwareClient = new(FakeClient)

type FakeClient struct {
	ExpectedName     string
	ExpectedErr      error
	ExpectedTest     bool
	ExpectedPriority uint
	ExpectedIdentity *authn.Identity
	ExpectedStats    map[string]any
}

func (f *FakeClient) Name() string {
	return f.ExpectedName
}

func (f *FakeClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

func (f FakeClient) IsEnabled() bool { return true }

func (f *FakeClient) GetConfig() authn.SSOClientConfig {
	return nil
}

func (f *FakeClient) Test(ctx context.Context, r *authn.Request) bool {
	return f.ExpectedTest
}

func (f *FakeClient) Priority() uint {
	return f.ExpectedPriority
}

func (f *FakeClient) UsageStatFn(ctx context.Context) (map[string]any, error) {
	return f.ExpectedStats, f.ExpectedErr
}

var _ authn.PasswordClient = new(FakePasswordClient)

type FakePasswordClient struct {
	ExpectedErr      error
	ExpectedIdentity *authn.Identity
}

func (f FakePasswordClient) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

var _ authn.RedirectClient = new(FakeRedirectClient)

type FakeRedirectClient struct {
	ExpectedErr      error
	ExpectedURL      string
	ExpectedName     string
	ExpectedOK       bool
	ExpectedRedirect *authn.Redirect
	ExpectedIdentity *authn.Identity
}

func (f FakeRedirectClient) Name() string {
	return f.ExpectedName
}

func (f FakeRedirectClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

func (f FakeRedirectClient) IsEnabled() bool { return true }

func (f FakeRedirectClient) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	return f.ExpectedRedirect, f.ExpectedErr
}

func (f FakeRedirectClient) Test(ctx context.Context, r *authn.Request) bool {
	return f.ExpectedOK
}
