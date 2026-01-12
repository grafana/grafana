package authorizer

import (
	"context"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var (
	// Shared test user identity
	user = authn.NewIDTokenAuthInfo(
		authn.Claims[authn.AccessTokenClaims]{
			Claims: jwt.Claims{Issuer: "grafana",
				Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana"), Audience: []string{"iam.grafana.app"}},
			Rest: authn.AccessTokenClaims{
				Namespace:            "*",
				Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
				DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
			},
		}, &authn.Claims[authn.IDTokenClaims]{
			Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeUser, "u001")},
			Rest:   authn.IDTokenClaims{Namespace: "org-2", Identifier: "u001", Type: types.TypeUser},
		},
	)
)

var _ types.AccessClient = (*fakeAccessClient)(nil)

// fakeAccessClient is a mock implementation of claims.AccessClient
type fakeAccessClient struct {
	checkCalled   bool
	checkFunc     func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error)
	compileCalled bool
	compileFunc   func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error)
}

func (m *fakeAccessClient) Check(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	m.checkCalled = true
	return m.checkFunc(id, &req, folder)
}

func (m *fakeAccessClient) Compile(ctx context.Context, id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	m.compileCalled = true
	return m.compileFunc(id, req)
}
