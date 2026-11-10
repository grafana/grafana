package legacypermissions

import (
	"context"
	"errors"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Organization and dashboard annotations are separate authorization resources.
type annotationListClient struct {
	fakeZanzanaClient
	organization, dashboard       *authzv1.ListResponse
	organizationErr, dashboardErr error
	calls                         []*authzv1.ListRequest
}

func (c *annotationListClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	var response *authzv1.ListResponse
	switch {
	case req.Group == "annotation.grafana.app" && req.Resource == "annotations" && req.Subresource == "":
		c.calls = append(c.calls, req)
		if c.organizationErr != nil {
			return nil, c.organizationErr
		}
		response = c.organization
	case req.Group == "dashboard.grafana.app" && req.Resource == "dashboards" && req.Subresource == "annotations":
		c.calls = append(c.calls, req)
		if c.dashboardErr != nil {
			return nil, c.dashboardErr
		}
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
		{name: "organization only", organization: &authzv1.ListResponse{All: true}, want: []string{"annotations:type:organization"}},
		{name: "dashboard and folder", dashboard: &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1"}}, want: []string{"dashboards:uid:dash1", "folders:uid:folder1"}},
		{name: "dashboard wildcard", dashboard: &authzv1.ListResponse{All: true}, want: []string{"dashboards:*", "folders:*"}},
		{name: "both resources", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{All: true}, want: []string{"annotations:type:organization", "dashboards:*", "folders:*"}},
		{name: "filtered folder", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{Items: []string{"dash1"}, Folders: []string{"folder1", "folder2"}}, scope: "folders:uid:folder1", want: []string{"folders:uid:folder1"}},
		{name: "filtered dashboard wildcard", organization: &authzv1.ListResponse{All: true}, dashboard: &authzv1.ListResponse{All: true}, scope: "dashboards:uid:dash1", want: []string{"dashboards:*"}},
		{name: "filtered folder wildcard", dashboard: &authzv1.ListResponse{All: true}, scope: "folders:uid:folder1", want: []string{"folders:*"}},
		{name: "folder wildcard filter", dashboard: &authzv1.ListResponse{All: true}, scope: "folders:*", want: []string{"folders:*"}},
		{name: "no grants"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := &annotationListClient{organization: tc.organization, dashboard: tc.dashboard}
			r := &ZanzanaPermissionResolver{client: client}
			result, err := r.searchPermissionsForIdentity(t.Context(), "org-1", 42, "u1", false,
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
			result, err := r.searchPermissionsForIdentity(t.Context(), "org-1", 42, "u1", false, tc.options)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"annotations:type:organization", "dashboards:uid:dash1", "folders:uid:folder1"}, permScopes(result[42], tc.action))
			requireAnnotationResourceCalls(t, client, tc.verb)
		})
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

func TestAnnotationPermissionListingResourceErrors(t *testing.T) {
	lookupErr := errors.New("lookup failed")
	cases := []struct {
		name                          string
		organizationErr, dashboardErr error
		wantErr                       error
	}{
		{name: "organization lookup fails", organizationErr: lookupErr, wantErr: lookupErr},
		{name: "dashboard lookup fails", dashboardErr: lookupErr, wantErr: lookupErr},
		{name: "both lookups fail", organizationErr: lookupErr, dashboardErr: lookupErr, wantErr: lookupErr},
		{name: "organization canceled", organizationErr: context.Canceled, wantErr: context.Canceled},
		{name: "dashboard canceled", dashboardErr: context.Canceled, wantErr: context.Canceled},
		{name: "organization deadline exceeded", organizationErr: context.DeadlineExceeded, wantErr: context.DeadlineExceeded},
		{name: "dashboard deadline exceeded", dashboardErr: context.DeadlineExceeded, wantErr: context.DeadlineExceeded},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := &annotationListClient{
				organization:    &authzv1.ListResponse{All: true},
				dashboard:       &authzv1.ListResponse{Items: []string{"dash1"}},
				organizationErr: tc.organizationErr, dashboardErr: tc.dashboardErr,
			}
			r := &ZanzanaPermissionResolver{client: client}
			result, err := r.searchPermissionsForIdentity(t.Context(), "org-1", 42, "u1", false, ac.SearchOptions{Action: "annotations:read"})
			require.ErrorIs(t, err, tc.wantErr)
			require.Nil(t, result)
		})
	}
}
