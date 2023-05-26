package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Service = new(FakeService)

type FakeService struct {
	ExpectedErr      error
	ExpectedRedirect *authn.Redirect
	ExpectedIdentity *authn.Identity
}

func (f FakeService) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

func (f FakeService) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {}

func (f FakeService) Login(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

func (f FakeService) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {}

func (f FakeService) RedirectURL(ctx context.Context, client string, r *authn.Request) (*authn.Redirect, error) {
	return f.ExpectedRedirect, f.ExpectedErr
}

func (f FakeService) RegisterClient(c authn.Client) {}

var _ authn.ContextAwareClient = new(FakeClient)

type FakeClient struct {
	ExpectedName     string
	ExpectedErr      error
	ExpectedTest     bool
	ExpectedPriority uint
	ExpectedIdentity *authn.Identity
	ExpectedStats    map[string]interface{}
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

func (f *FakeClient) UsageStatFn(ctx context.Context) (map[string]interface{}, error) {
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
