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
		t.Run(tc.name, func(t *testing.T) {
			client := &annotationListClient{organization: tc.organization, dashboard: tc.dashboard}
			r := &ZanzanaPermissionResolver{client: client}
			result, err := r.searchPermissionsForIdentity(t.Context(), 1, 42, "u1", false,
				ac.SearchOptions{Action: "annotations:read", Scope: tc.scope})
			require.NoError(t, err)
			require.ElementsMatch(t, tc.want, permScopes(result[42], "annotations:read"))
			requireAnnotationResourceCalls(t, client, "get")
		})
	}
}

func TestAnnotationPermissionListingSearchModes(t *testing.T) {
	cases := []struct {
		name         string
		options      ac.SearchOptions
		action, verb string
	}{
		{name: "read action", options: ac.SearchOptions{Action: "annotations:read"}, action: "annotations:read", verb: "get"},
		{name: "create action", options: ac.SearchOptions{Action: "annotations:create"}, action: "annotations:create", verb: "create"},
		{name: "write action", options: ac.SearchOptions{Action: "annotations:write"}, action: "annotations:write", verb: "update"},
		{name: "delete action", options: ac.SearchOptions{Action: "annotations:delete"}, action: "annotations:delete", verb: "delete"},
		{name: "prefix", options: ac.SearchOptions{ActionPrefix: "annotations:"}, action: "annotations:read", verb: "get"},
		{name: "unfiltered", action: "annotations:read", verb: "get"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := &annotationListClient{
				organization: &authzv1.ListResponse{All: true},
				dashboard:    &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1"}},
			}
			r := &ZanzanaPermissionResolver{client: client}
			result, err := r.searchPermissionsForIdentity(t.Context(), 1, 42, "u1", false, tc.options)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"annotations:*", "dashboards:uid:dash1", "folders:uid:folder1"}, permScopes(result[42], tc.action))
			requireAnnotationResourceCalls(t, client, tc.verb)
		})
	}
}

func TestResolveCurrentUserPermissions_AnnotationResources(t *testing.T) {
	client := &annotationListClient{
		organization: &authzv1.ListResponse{All: true},
		dashboard:    &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1"}},
	}
	r := &ZanzanaPermissionResolver{client: client}
	user := &identity.StaticRequester{Type: "user", UserUID: "u1", OrgID: 1, Namespace: "default"}
	perms, err := r.ResolveCurrentUserPermissions(t.Context(), user)
	require.NoError(t, err)
	for action, verb := range map[string]string{"annotations:read": "get", "annotations:create": "create", "annotations:write": "update", "annotations:delete": "delete"} {
		require.ElementsMatch(t, []string{"annotations:*", "dashboards:uid:dash1", "folders:uid:folder1"}, permScopes(perms, action), action)
		requireAnnotationResourceCalls(t, client, verb)
	}
}

func requireAnnotationResourceCalls(t *testing.T, client *annotationListClient, verb string) {
	t.Helper()
	var groups []string
	for _, call := range client.calls {
		if call.Verb == verb {
			groups = append(groups, call.Group)
		}
	}
	require.ElementsMatch(t, []string{"annotation.grafana.app", "dashboard.grafana.app"}, groups, "query each distinct resource once per action")
}
