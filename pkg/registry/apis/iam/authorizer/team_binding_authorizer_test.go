package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newTeamBinding(teamName, name, subjectName string) *iamv0.TeamBinding {
	return &iamv0.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{Namespace: "org-2", Name: name},
		Spec: iamv0.TeamBindingSpec{
			TeamRef: iamv0.TeamBindingTeamRef{
				Name: teamName,
			},
			Subject: iamv0.TeamBindingspecSubject{
				Name: subjectName,
			},
		},
	}
}

func TestTeamBinding_AfterGet(t *testing.T) {
	tests := []struct {
		name        string
		teamBinding *iamv0.TeamBinding
		shouldAllow bool
		checkCalled bool
	}{
		{
			name:        "allow access via permission",
			teamBinding: newTeamBinding("team-1", "binding-1", "other"),
			shouldAllow: true,
			checkCalled: true,
		},
		{
			name:        "deny access",
			teamBinding: newTeamBinding("team-1", "binding-1", "other"),
			shouldAllow: false,
			checkCalled: true, // called but returns allowed=false
		},
		{
			name:        "allow access via subject match",
			teamBinding: newTeamBinding("team-1", "binding-1", "u001"),
			shouldAllow: true,
			checkCalled: false, // short-circuits
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.NotNil(t, id)
				require.Equal(t, "u001", id.GetIdentifier())

				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbGetPermissions, req.Verb)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewTeamBindingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.AfterGet(ctx, tt.teamBinding)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.Equal(t, tt.checkCalled, accessClient.checkCalled)
		})
	}
}

func TestTeamBinding_FilterList(t *testing.T) {
	list := &iamv0.TeamBindingList{
		Items: []iamv0.TeamBinding{
			*newTeamBinding("team-1", "binding-1", "other"), // Access via permission
			*newTeamBinding("team-2", "binding-2", "other"), // No access
			*newTeamBinding("team-3", "binding-3", "u001"),  // Access via subject match
		},
	}

	compileFunc := func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
		require.NotNil(t, id)
		require.Equal(t, "u001", id.GetIdentifier())

		require.Equal(t, "org-2", req.Namespace)
		require.Equal(t, iamv0.GROUP, req.Group)
		require.Equal(t, iamv0.TeamResourceInfo.GroupResource().Resource, req.Resource)
		require.Equal(t, utils.VerbGetPermissions, req.Verb)

		return func(name, folder string) bool {
			return name == "team-1"
		}, &types.NoopZookie{}, nil
	}

	accessClient := &fakeAccessClient{compileFunc: compileFunc}
	authz := NewTeamBindingAuthorizer(accessClient)
	ctx := types.WithAuthInfo(context.Background(), user)

	obj, err := authz.FilterList(ctx, list)
	require.NoError(t, err)
	require.NotNil(t, list)
	require.True(t, accessClient.compileCalled)

	filtered, ok := obj.(*iamv0.TeamBindingList)
	require.True(t, ok)
	require.Len(t, filtered.Items, 2)

	names := []string{filtered.Items[0].Name, filtered.Items[1].Name}
	require.Contains(t, names, "binding-1")
	require.Contains(t, names, "binding-3")
}

func TestTeamBinding_BeforeCreate(t *testing.T) {
	binding := newTeamBinding("team-1", "binding-1", "other")

	tests := []struct {
		name        string
		shouldAllow bool
	}{
		{
			name:        "allow create",
			shouldAllow: true,
		},
		{
			name:        "deny create",
			shouldAllow: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewTeamBindingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.BeforeCreate(ctx, binding)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}

func TestTeamBinding_BeforeUpdate(t *testing.T) {
	binding := newTeamBinding("team-1", "binding-1", "other")

	tests := []struct {
		name        string
		shouldAllow bool
	}{
		{
			name:        "allow update",
			shouldAllow: true,
		},
		{
			name:        "deny update",
			shouldAllow: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewTeamBindingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.BeforeUpdate(ctx, binding)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}

func TestTeamBinding_BeforeDelete(t *testing.T) {
	binding := newTeamBinding("team-1", "binding-1", "other")

	tests := []struct {
		name        string
		shouldAllow bool
	}{
		{
			name:        "allow delete",
			shouldAllow: true,
		},
		{
			name:        "deny delete",
			shouldAllow: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewTeamBindingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.BeforeDelete(ctx, binding)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}
