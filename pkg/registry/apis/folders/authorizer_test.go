package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestFolderAuthorizer(t *testing.T) {
	type input struct {
		verb   string
		info   authlib.AuthInfo
		client authlib.AccessChecker
	}

	type expected struct {
		authorized authorizer.Decision
		err        bool
	}

	tests := []struct {
		name     string
		input    input
		expected expected
	}{
		{
			name: "missing auth info",
			input: input{
				verb:   utils.VerbGet,
				client: authz.NewClient(nil),
			},
			expected: expected{
				authorized: authorizer.DecisionDeny,
			},
		},
		{
			name: "access policy identity with correct permissions should be able to authorize",
			input: input{
				verb: utils.VerbGet,
				info: authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
					Claims: jwt.Claims{
						Subject: "access-policy:123",
					},
					Rest: authn.AccessTokenClaims{
						Namespace: "stacks-1",
						Permissions: []string{
							"folder.grafana.app/folders:get",
						},
					},
				}),
				client: authz.NewClient(nil),
			},
			expected: expected{
				authorized: authorizer.DecisionAllow,
			},
		},
		{
			name: "access policy identity without correct permissions should not be able to authorize",
			input: input{
				verb: utils.VerbGet,
				info: authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
					Claims: jwt.Claims{
						Subject: "access-policy:123",
					},
					Rest: authn.AccessTokenClaims{
						Namespace: "stacks-1",
						Permissions: []string{
							"folder.grafana.app/folders:create",
						},
					},
				}),
				client: authz.NewClient(nil),
			},
			expected: expected{
				authorized: authorizer.DecisionDeny,
			},
		},
		{
			name: "with client error",
			input: input{
				verb: utils.VerbGet,
				info: authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{}, &authn.Claims[authn.IDTokenClaims]{}),
				client: &dummyClient{
					check: func(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
						return authlib.CheckResponse{}, fmt.Errorf("nope")
					},
				},
			},
			expected: expected{
				authorized: authorizer.DecisionDeny,
				err:        true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authz := newAuthorizer(tt.input.client)
			authorized, _, err := authz.Authorize(
				authlib.WithAuthInfo(context.Background(), tt.input.info),
				authorizer.AttributesRecord{User: tt.input.info, Verb: tt.input.verb, APIGroup: folders.GROUP, Resource: "folders", ResourceRequest: true, Name: "123", Namespace: "stacks-1"},
			)

			if tt.expected.err {
				require.Error(t, err)
				require.Equal(t, authorizer.DecisionDeny, authorized)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected.authorized, authorized)
		})
	}
}

type dummyClient struct {
	check func(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error)
}

func (c *dummyClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	return c.check(ctx, info, req)
}
