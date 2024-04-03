package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Service = new(FakeService)
var _ authn.IdentitySynchronizer = new(FakeService)

type FakeService struct {
	ExpectedErr        error
	ExpectedRedirect   *authn.Redirect
	ExpectedIdentity   *authn.Identity
	ExpectedErrs       []error
	ExpectedIdentities []*authn.Identity
	CurrentIndex       int
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

func (f *FakeService) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {}

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

func (f *FakeService) ResolveIdentity(ctx context.Context, orgID int64, namespaceID string) (*authn.Identity, error) {
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

func (f FakeRedirectClient) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	return f.ExpectedRedirect, f.ExpectedErr
}

func (f FakeRedirectClient) Test(ctx context.Context, r *authn.Request) bool {
	return f.ExpectedOK
}
