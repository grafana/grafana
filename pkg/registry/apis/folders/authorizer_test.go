package folders

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLegacyAuthorizer(t *testing.T) {
	type input struct {
		user identity.Requester
		verb string
	}
	type expect struct {
		authorized authorizer.Decision
		err        error
	}
	var orgID int64 = 1

	tests := []struct {
		name   string
		input  input
		expect expect
	}{
		{
			name: "user with create permissions should be able to create a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				authorized: authorizer.DecisionAllow,
			},
		},
		{
			name: "not possible to create a folder without a user",
			input: input{
				user: nil,
				verb: string(utils.VerbCreate),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
		{
			name: "user without permissions should not be able to create a folder",
			input: input{
				user: &user.SignedInUser{},
				verb: string(utils.VerbCreate),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
		{
			name: "user in another orgId should not be able to create a folder ",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  2,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbCreate),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
		{
			name: "user with read permissions should be able to list folders",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbList),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
		{
			name: "user with delete permissions should be able to delete a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersDelete: {dashboards.ScopeFoldersAll}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbDelete),
			},
			expect: expect{authorized: authorizer.DecisionAllow},
		},
		{
			name: "user without delete permissions should NOT be able to delete a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbDelete),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
		{
			name: "user with write permissions should be able to update a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbUpdate),
			},
			expect: expect{authorized: authorizer.DecisionAllow},
		},
		{
			name: "user without write permissions should NOT be able to update a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbUpdate),
			},
			expect: expect{authorized: authorizer.DecisionDeny},
		},
	}

	authz := newLegacyAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders")))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authorized, _, err := authz.Authorize(
				identity.WithRequester(context.Background(), tt.input.user),
				authorizer.AttributesRecord{User: tt.input.user, Verb: tt.input.verb, Resource: "folders", ResourceRequest: true, Name: "123"},
			)
			if tt.expect.err != nil {
				require.Error(t, err)
				require.Equal(t, authorizer.DecisionDeny, authorized)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expect.authorized, authorized)
		})
	}
}

func TestMultiTenantAuthorizer(t *testing.T) {
	type input struct {
		verb   string
		info   types.AuthInfo
		client types.AccessClient
	}

	type expected struct {
		authorized authorizer.Decision
		err        bool
	}

	tests := []struct {
		name    string
		input   input
		expeted expected
	}{
		{
			name: "non access policy idenity should not be able to authorize",
			input: input{
				verb: utils.VerbGet,
				info: &identity.StaticRequester{
					Type:    types.TypeUser,
					UserID:  1,
					UserUID: "1",
				},
			},
			expeted: expected{
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
			expeted: expected{
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
			expeted: expected{
				authorized: authorizer.DecisionDeny,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authz := newMultiTenantAuthorizer(tt.input.client)
			authorized, _, err := authz.Authorize(
				types.WithAuthInfo(context.Background(), tt.input.info),
				authorizer.AttributesRecord{User: tt.input.info, Verb: tt.input.verb, APIGroup: folders.GROUP, Resource: "folders", ResourceRequest: true, Name: "123", Namespace: "stacks-1"},
			)

			if tt.expeted.err {
				require.Error(t, err)
				require.Equal(t, authorizer.DecisionDeny, authorized)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expeted.authorized, authorized)
		})
	}
}
