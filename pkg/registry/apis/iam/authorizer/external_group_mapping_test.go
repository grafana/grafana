package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newExternalGroupMapping(teamName, name string) *iamv0.ExternalGroupMapping {
	return &iamv0.ExternalGroupMapping{
		ObjectMeta: metav1.ObjectMeta{Namespace: "org-2", Name: name},
		Spec: iamv0.ExternalGroupMappingSpec{
			TeamRef: iamv0.ExternalGroupMappingTeamRef{
				Name: teamName,
			},
		},
	}
}

func TestExternalGroupMapping_AfterGet(t *testing.T) {
	mapping := newExternalGroupMapping("team-1", "mapping-1")

	tests := []struct {
		name        string
		shouldAllow bool
	}{
		{
			name:        "allow access",
			shouldAllow: true,
		},
		{
			name:        "deny access",
			shouldAllow: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.NotNil(t, id)
				require.Equal(t, "user:u001", id.GetUID())
				require.Equal(t, "org-2", id.GetNamespace())

				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbGetPermissions, req.Verb)
				require.Equal(t, "", folder)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewExternalGroupMappingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.AfterGet(ctx, mapping)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}

func TestExternalGroupMapping_FilterList(t *testing.T) {
	list := &iamv0.ExternalGroupMappingList{
		Items: []iamv0.ExternalGroupMapping{
			*newExternalGroupMapping("team-1", "mapping-1"),
			*newExternalGroupMapping("team-2", "mapping-2"),
		},
		ListMeta: metav1.ListMeta{
			SelfLink: "/apis/iam.grafana.app/v0alpha1/namespaces/org-2/externalgroupmappings",
		},
	}

	compileFunc := func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
		require.NotNil(t, id)
		require.Equal(t, "user:u001", id.GetUID())
		require.Equal(t, "org-2", id.GetNamespace())

		require.Equal(t, "org-2", req.Namespace)
		require.Equal(t, iamv0.GROUP, req.Group)
		require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
		require.Equal(t, utils.VerbGetPermissions, req.Verb)

		return func(name, folder string) bool {
			return name == "team-1"
		}, &types.NoopZookie{}, nil
	}

	accessClient := &fakeAccessClient{compileFunc: compileFunc}
	authz := NewExternalGroupMappingAuthorizer(accessClient)
	ctx := types.WithAuthInfo(context.Background(), user)

	obj, err := authz.FilterList(ctx, list)
	require.NoError(t, err)
	require.NotNil(t, list)
	require.True(t, accessClient.compileCalled)

	filtered, ok := obj.(*iamv0.ExternalGroupMappingList)
	require.True(t, ok)
	require.Len(t, filtered.Items, 1)
	require.Equal(t, "mapping-1", filtered.Items[0].Name)
}

func TestExternalGroupMapping_BeforeCreate(t *testing.T) {
	mapping := newExternalGroupMapping("team-1", "mapping-1")

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
				require.NotNil(t, id)
				require.Equal(t, "user:u001", id.GetUID())
				require.Equal(t, "org-2", id.GetNamespace())

				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)
				require.Equal(t, "", folder)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewExternalGroupMappingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.BeforeCreate(ctx, mapping)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}

func TestExternalGroupMapping_BeforeUpdate(t *testing.T) {
	mapping := newExternalGroupMapping("team-1", "mapping-1")

	accessClient := &fakeAccessClient{
		checkFunc: func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
			require.Fail(t, "check should not be called")
			return types.CheckResponse{}, nil
		},
	}
	authz := NewExternalGroupMappingAuthorizer(accessClient)
	ctx := types.WithAuthInfo(context.Background(), user)

	err := authz.BeforeUpdate(ctx, mapping)
	require.Error(t, err)
	require.True(t, apierrors.IsMethodNotSupported(err))
	require.Contains(t, err.Error(), "PUT/PATCH")
	require.False(t, accessClient.checkCalled)
}

func TestExternalGroupMapping_BeforeDelete(t *testing.T) {
	mapping := newExternalGroupMapping("team-1", "mapping-1")

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
				require.NotNil(t, id)
				require.Equal(t, "user:u001", id.GetUID())
				require.Equal(t, "org-2", id.GetNamespace())

				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, iamv0.GROUP, req.Group)
				require.Equal(t, iamv0.TeamResourceInfo.GetName(), req.Resource)
				require.Equal(t, "team-1", req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)
				require.Equal(t, "", folder)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			authz := NewExternalGroupMappingAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := authz.BeforeDelete(ctx, mapping)
			if tt.shouldAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			require.True(t, accessClient.checkCalled)
		})
	}
}
