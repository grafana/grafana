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
	ExpectedErr          error
	ExpectedTest         bool
	ExpectedIdentity     *authn.Identity
	ExpectedClientParams *authn.ClientParams
}

func (f *FakeClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, *authn.ClientParams, error) {
	return f.ExpectedIdentity, f.ExpectedClientParams, f.ExpectedErr
}

func (f *FakeClient) Test(ctx context.Context, r *authn.Request) bool {
	return f.ExpectedTest
}
