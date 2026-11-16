package legacypermissions

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestListPermissionsSecureValueScopes(t *testing.T) {
	for _, action := range []string{
		"secret.securevalues:read",
		"secret.securevalues:write",
		"secret.securevalues:delete",
		"secret.securevalues:create",
		"secret.securevalues.permissions:read",
		"secret.securevalues.permissions:write",
	} {
		for _, tc := range []struct {
			name     string
			response *authzv1.ListResponse
			scope    string
		}{
			{"named", &authzv1.ListResponse{Items: []string{"personal-one"}}, "secret.securevalues:uid:personal-one"},
			{"wildcard", &authzv1.ListResponse{All: true}, "secret.securevalues:*"},
		} {
			t.Run(action+"/"+tc.name, func(t *testing.T) {
				for _, filter := range []string{"", "secret.securevalues:uid:personal-one"} {
					perms, err := zanzanaResolve(tc.response, action, filter)
					require.NoError(t, err)
					require.Equal(t, []ac.Permission{{Action: action, Scope: tc.scope}}, perms)
				}
			})
		}
	}
}

// Only secrets have grants, so enumeration cannot accidentally pass on an
// unrelated resource response or a permission loaded from legacy SQL.
type secureValueScopeClient struct {
	fakeZanzanaClient
	response *authzv1.ListResponse
}

func (c *secureValueScopeClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	if req.Group == "secret.grafana.app" && req.Resource == "securevalues" {
		return c.response, nil
	}
	return &authzv1.ListResponse{}, nil
}

func TestSecureValueScopesThroughEnumerationAndSearch(t *testing.T) {
	for _, tc := range []struct {
		name     string
		response *authzv1.ListResponse
		scope    string
	}{
		{"named", &authzv1.ListResponse{Items: []string{"personal-one"}}, "secret.securevalues:uid:personal-one"},
		{"wildcard", &authzv1.ListResponse{All: true}, "secret.securevalues:*"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := &ZanzanaPermissionResolver{client: &secureValueScopeClient{response: tc.response}}
			usr := &identity.StaticRequester{Type: claims.TypeUser, UserID: 42, UserUID: "alice", OrgID: 1}
			perms, err := r.ResolveCurrentUserPermissions(t.Context(), usr)
			require.NoError(t, err)
			want := []ac.Permission{
				{Action: "secret.securevalues:read", Scope: tc.scope},
				{Action: "secret.securevalues:write", Scope: tc.scope},
				{Action: "secret.securevalues:delete", Scope: tc.scope},
				{Action: "secret.securevalues:create", Scope: tc.scope},
				{Action: "secret.securevalues.permissions:read", Scope: tc.scope},
				{Action: "secret.securevalues.permissions:write", Scope: tc.scope},
			}
			require.ElementsMatch(t, want, perms)

			for _, options := range []ac.SearchOptions{
				{Action: "secret.securevalues:read"},
				{Action: "secret.securevalues.permissions:read"},
				{ActionPrefix: "secret.securevalues"},
				{},
			} {
				for _, scope := range []string{"", "secret.securevalues:uid:personal-one", "securevalues:uid:personal-one"} {
					options.Scope = scope
					result, err := r.searchPermissionsForIdentity(t.Context(), 1, 42, "alice", false, options)
					require.NoError(t, err)
					if scope == "securevalues:uid:personal-one" {
						require.Empty(t, result, "must not match the API resource name as a legacy scope")
						continue
					}
					if options.Action != "" {
						require.Equal(t, []ac.Permission{{Action: options.Action, Scope: tc.scope}}, result[42])
					} else {
						require.ElementsMatch(t, want, result[42])
					}
				}
			}
		})
	}
}
