package authntest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = new(MockClient)

type MockClient struct {
	AuthenticateFunc func(ctx context.Context, r *authn.Request) (*authn.Identity, error)
	ClientParamsFunc func() *authn.ClientParams
	TestFunc         func(ctx context.Context, r *authn.Request) bool
}

func (m MockClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if m.AuthenticateFunc != nil {
		return m.AuthenticateFunc(ctx, r)
	}
	return nil, nil
}

func (m MockClient) ClientParams() *authn.ClientParams {
	if m.ClientParamsFunc != nil {
		return m.ClientParamsFunc()
	}
	return nil
}

func (m MockClient) Test(ctx context.Context, r *authn.Request) bool {
	if m.TestFunc != nil {
		return m.TestFunc(ctx, r)
	}
	return false
}
