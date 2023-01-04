package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

type FakeService struct {
	authn.Service
}

var _ authn.Client = new(FakeClient)

type FakeClient struct {
	ExpectedErr      error
	ExpectedTest     bool
	ExpectedIdentity *authn.Identity
}

func (f *FakeClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return f.ExpectedIdentity, f.ExpectedErr
}

func (f *FakeClient) ClientParams() *authn.ClientParams {
	return &authn.ClientParams{}
}

func (f *FakeClient) Test(ctx context.Context, r *authn.Request) bool {
	return f.ExpectedTest
}
