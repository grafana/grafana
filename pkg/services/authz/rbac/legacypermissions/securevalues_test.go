package legacypermissions

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

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

type secureValueScopeClient struct {
	fakeZanzanaClient
	grants map[string]*authzv1.ListResponse
}

func (c *secureValueScopeClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	if req.Group == "secret.grafana.app" && req.Resource == "securevalues" {
		if grant := c.grants[req.Verb]; grant != nil {
			return grant, nil
		}
	}
	return &authzv1.ListResponse{}, nil
}

func TestSecureValueScopesThroughSearch(t *testing.T) {
	r := &ZanzanaPermissionResolver{client: &secureValueScopeClient{grants: map[string]*authzv1.ListResponse{
		"get":             {Items: []string{"readable"}},
		"get_permissions": {Items: []string{"inspectable"}},
		"update":          {Items: []string{"editable"}},
		"delete":          {Items: []string{"deletable"}},
		"create":          {All: true},
		"set_permissions": {Items: []string{"manageable"}},
	}}}
	read := ac.Permission{Action: "secret.securevalues:read", Scope: "secret.securevalues:uid:readable"}
	readPermissions := ac.Permission{Action: "secret.securevalues.permissions:read", Scope: "secret.securevalues:uid:inspectable"}
	create := ac.Permission{Action: "secret.securevalues:create", Scope: "secret.securevalues:*"}
	all := []ac.Permission{
		read, readPermissions, create,
		{Action: "secret.securevalues:write", Scope: "secret.securevalues:uid:editable"},
		{Action: "secret.securevalues:delete", Scope: "secret.securevalues:uid:deletable"},
		{Action: "secret.securevalues.permissions:write", Scope: "secret.securevalues:uid:manageable"},
	}
	for _, tc := range []struct {
		name    string
		options ac.SearchOptions
		want    []ac.Permission
	}{
		{"read", ac.SearchOptions{Action: read.Action}, []ac.Permission{read}},
		{"read permissions", ac.SearchOptions{Action: readPermissions.Action}, []ac.Permission{readPermissions}},
		{"read permissions on readable object", ac.SearchOptions{Action: readPermissions.Action, Scope: read.Scope}, nil},
		{"wildcard covers named object", ac.SearchOptions{Action: create.Action, Scope: read.Scope}, []ac.Permission{create}},
		{"action prefix", ac.SearchOptions{ActionPrefix: "secret.securevalues"}, all},
		{"all actions", ac.SearchOptions{}, all},
		{"all actions on readable object", ac.SearchOptions{Scope: read.Scope}, []ac.Permission{read, create}},
		{"API resource prefix on wildcard grant", ac.SearchOptions{Action: create.Action, Scope: "securevalues:uid:readable"}, nil},
		{"API resource as scope prefix", ac.SearchOptions{Scope: "securevalues:uid:readable"}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := r.searchPermissionsForIdentity(t.Context(), "org-1", 42, "alice", false, tc.options)
			require.NoError(t, err)
			if len(tc.want) == 0 {
				require.Empty(t, result)
				return
			}
			require.ElementsMatch(t, tc.want, result[42])
		})
	}
}
