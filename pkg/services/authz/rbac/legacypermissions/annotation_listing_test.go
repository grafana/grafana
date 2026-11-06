package legacypermissions

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Organization and dashboard annotations are separate authorization resources.
type annotationListClient struct {
	fakeZanzanaClient
	organization, dashboard *authzv1.ListResponse
	calls                   []*authzv1.ListRequest
}

func (c *annotationListClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	var response *authzv1.ListResponse
	switch {
	case req.Group == "annotation.grafana.app" && req.Resource == "annotations" && req.Subresource == "":
		c.calls = append(c.calls, req)
		response = c.organization
	case req.Group == "dashboard.grafana.app" && req.Resource == "dashboards" && req.Subresource == "annotations":
		c.calls = append(c.calls, req)
		response = c.dashboard
	}
	if response == nil {
		return &authzv1.ListResponse{}, nil
	}
	return response, nil
}

func TestAnnotationPermissionListingIncludesBothResources(t *testing.T) {
	cases := []struct {
		name                    string
		organization, dashboard *authzv1.ListResponse
		scope                   string
		want                    []string
	}{
		{name: "organization only", organization: &authzv1.ListResponse{All: true}, want: []string{"annotations:*"}},
		{name: "dashboard and folder", dashboard: &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1"}}, want: []string{"dashboards:uid:dash1", "folders:uid:folder1"}},
		{name: "dashboard wildcard", dashboard: &authzv1.ListResponse{All: true}, want: []string{"dashboards:*"}},
		{name: "both resources", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{All: true}, want: []string{"annotations:*", "dashboards:*"}},
		{name: "filtered folder", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1", "folder2"}}, scope: "folders:uid:folder1", want: []string{"folders:uid:folder1"}},
		{name: "filtered dashboard wildcard", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{All: true}, scope: "dashboards:uid:dash1", want: []string{"dashboards:*"}},
		{name: "no grants"},
	}
	for _, tc := range cases {
		for action, verb := range map[string]string{"annotations:read": "get", "annotations:create": "create", "annotations:write": "update", "annotations:delete": "delete"} {
			for _, mode := range []string{"action", "prefix", "all", "current user"} {
				t.Run(tc.name+"/"+action+"/"+mode, func(t *testing.T) {
					if mode == "current user" && tc.scope != "" {
						t.Skip("current user listing has no scope filter")
					}
					client := &annotationListClient{organization: tc.organization, dashboard: tc.dashboard}
					r := &ZanzanaPermissionResolver{client: client}
					var perms []ac.Permission
					if mode == "current user" {
						var err error
						perms, err = r.ResolveCurrentUserPermissions(t.Context(), &identity.StaticRequester{Type: "user", UserUID: "u1", OrgID: 1, Namespace: "default"})
						require.NoError(t, err)
					} else {
						options := ac.SearchOptions{Scope: tc.scope}
						if mode == "action" {
							options.Action = action
						}
						if mode == "prefix" {
							options.ActionPrefix = "annotations:"
						}
						result, err := r.searchPermissionsForIdentity(t.Context(), 1, 42, "u1", false, options)
						require.NoError(t, err)
						perms = result[42]
					}
					require.ElementsMatch(t, tc.want, permScopes(perms, action))
					var groups []string
					for _, call := range client.calls {
						if call.Verb == verb {
							groups = append(groups, call.Group)
						}
					}
					require.ElementsMatch(t, []string{"annotation.grafana.app", "dashboard.grafana.app"}, groups, "query each distinct resource once, despite duplicate dashboard/folder translations")
				})
			}
		}
	}
}
