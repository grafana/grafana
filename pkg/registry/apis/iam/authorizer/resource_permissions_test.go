package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newResourcePermission(apiGroup, resource, name string) *iamv0.ResourcePermission {
	return &iamv0.ResourcePermission{
		ObjectMeta: metav1.ObjectMeta{Namespace: "org-2"},
		Spec: iamv0.ResourcePermissionSpec{
			Resource: iamv0.ResourcePermissionspecResource{
				ApiGroup: apiGroup,
				Resource: resource,
				Name:     name,
			},
		},
	}
}

func TestResourcePermissions_AfterGet(t *testing.T) {
	// In this test, we verify that AfterGet calls accessClient.Check with the correct parameters
	fold1 := newResourcePermission("folder.grafana.app", "folders", "fold-1")

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
			parent := "fold-1"
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.NotNil(t, id)
				// First call may be users.permissions:read (Group=iam.grafana.app, Resource=users); deny so we fall through to resource check
				if req.Group == iamv0.GROUP && req.Resource == "users" {
					return types.CheckResponse{Allowed: false}, nil
				}
				// Check is called with the user's identity for the target resource
				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, fold1.Spec.Resource.ApiGroup, req.Group)
				require.Equal(t, fold1.Spec.Resource.Resource, req.Resource)
				require.Equal(t, fold1.Spec.Resource.Name, req.Name)
				require.Equal(t, utils.VerbGetPermissions, req.Verb)
				require.Equal(t, parent, folder)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}
			getParentFunc := func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
				// For this test, we can return a fixed parent folder ID
				return parent, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			fakeParentProvider := &fakeParentProvider{hasParent: true, getParentFunc: getParentFunc}
			resPermAuthz := NewResourcePermissionsAuthorizer(accessClient, fakeParentProvider)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := resPermAuthz.AfterGet(ctx, fold1)
			if tt.shouldAllow {
				require.NoError(t, err, "expected no error for allowed access")
			} else {
				require.Error(t, err, "expected error for denied access")
				require.True(t, k8serrors.IsNotFound(err), "expected a 404 StatusError (not wrapped) to avoid leaking resource existence")
			}
			require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
			require.True(t, fakeParentProvider.getParentCalled, "parentProvider.GetParent should be called")
		})
	}
}

func TestResourcePermissions_AfterGet_WithUsersPermissionsRead(t *testing.T) {
	// When the user has users.permissions:read, AfterGet allows access without checking get_permissions on the specific resource.
	fold1 := newResourcePermission("folder.grafana.app", "folders", "fold-1")
	checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
		require.NotNil(t, id)
		// First (and only) check is for users.permissions:read (Group=iam.grafana.app, Resource=users, Name=*)
		require.Equal(t, iamv0.GROUP, req.Group)
		require.Equal(t, "users", req.Resource)
		require.Equal(t, utils.VerbGetPermissions, req.Verb)
		require.Equal(t, "*", req.Name)
		return types.CheckResponse{Allowed: true}, nil
	}
	getParentFunc := func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
		return "fold-1", nil
	}
	accessClient := &fakeAccessClient{checkFunc: checkFunc}
	fakeParentProvider := &fakeParentProvider{hasParent: true, getParentFunc: getParentFunc}
	resPermAuthz := NewResourcePermissionsAuthorizer(accessClient, fakeParentProvider)
	ctx := types.WithAuthInfo(context.Background(), user)

	err := resPermAuthz.AfterGet(ctx, fold1)
	require.NoError(t, err)
	require.True(t, accessClient.checkCalled, "accessClient.Check should be called for users.permissions:read")
	require.False(t, fakeParentProvider.getParentCalled, "GetParent should not be called when user has users.permissions:read")
}

func TestResourcePermissions_FilterList(t *testing.T) {
	// In this test, the user has permission to access only fold-1 and dash-2.
	// We verify that FilterList returns only those two objects (uses BatchCheck).

	list := &iamv0.ResourcePermissionList{
		Items: []iamv0.ResourcePermission{
			*newResourcePermission("folder.grafana.app", "folders", "fold-1"),
			*newResourcePermission("folder.grafana.app", "folders", "fold-2"),
			*newResourcePermission("dashboard.grafana.app", "dashboards", "dash-2"),
		},
	}

	// First Check is for users.permissions:read; deny so FilterList proceeds to BatchCheck.
	checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
		if req.Group == iamv0.GROUP && req.Resource == "users" {
			return types.CheckResponse{Allowed: false}, nil
		}
		return types.CheckResponse{}, nil
	}
	// FilterList uses CanViewTargets -> BatchCheck. Allow fold-1 (index 0) and dash-2 (index 2), deny fold-2 (index 1).
	batchCheckFunc := func(_ context.Context, id types.AuthInfo, req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
		require.NotNil(t, id)
		require.Equal(t, "user:u001", id.GetUID())
		require.Equal(t, "org-2", id.GetNamespace())
		require.Len(t, req.Checks, 3)
		results := make(map[string]types.BatchCheckResult)
		for _, c := range req.Checks {
			allowed := (c.Name == "fold-1") || (c.Name == "dash-2" && c.Folder == "fold-1")
			results[c.CorrelationID] = types.BatchCheckResult{Allowed: allowed}
		}
		return types.BatchCheckResponse{Results: results}, nil
	}

	getParentFunc := func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
		if name == "dash-2" {
			return "fold-1", nil
		}
		return "", nil
	}

	accessClient := &fakeAccessClient{checkFunc: checkFunc, batchCheckFunc: batchCheckFunc}
	fakeParentProvider := &fakeParentProvider{hasParent: true, getParentFunc: getParentFunc}
	resPermAuthz := NewResourcePermissionsAuthorizer(accessClient, fakeParentProvider)
	ctx := types.WithAuthInfo(context.Background(), user)

	obj, err := resPermAuthz.FilterList(ctx, list)
	require.NoError(t, err)
	require.NotNil(t, list)
	require.True(t, accessClient.batchCheckCalled, "accessClient.BatchCheck should be called")
	require.True(t, fakeParentProvider.getParentCalled, "parentProvider.GetParent should be called")

	filtered, ok := obj.(*iamv0.ResourcePermissionList)
	require.True(t, ok, "response should be of type ResourcePermissionList")
	require.Len(t, filtered.Items, 2, "response list should have 2 items after filtering")
	require.Equal(t, "fold-1", filtered.Items[0].Spec.Resource.Name)
	require.Equal(t, "dash-2", filtered.Items[1].Spec.Resource.Name)
}

func TestResourcePermissions_FilterList_WithUsersPermissionsRead(t *testing.T) {
	// When the user has users.permissions:read, FilterList returns all items without per-resource BatchCheck.
	list := &iamv0.ResourcePermissionList{
		Items: []iamv0.ResourcePermission{
			*newResourcePermission("folder.grafana.app", "folders", "fold-1"),
			*newResourcePermission("folder.grafana.app", "folders", "fold-2"),
			*newResourcePermission("dashboard.grafana.app", "dashboards", "dash-2"),
		},
	}
	checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
		require.Equal(t, iamv0.GROUP, req.Group)
		require.Equal(t, "users", req.Resource)
		require.Equal(t, utils.VerbGetPermissions, req.Verb)
		require.Equal(t, "*", req.Name)
		return types.CheckResponse{Allowed: true}, nil
	}
	getParentFunc := func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
		return "", nil
	}
	accessClient := &fakeAccessClient{checkFunc: checkFunc}
	fakeParentProvider := &fakeParentProvider{hasParent: true, getParentFunc: getParentFunc}
	resPermAuthz := NewResourcePermissionsAuthorizer(accessClient, fakeParentProvider)
	ctx := types.WithAuthInfo(context.Background(), user)

	obj, err := resPermAuthz.FilterList(ctx, list)
	require.NoError(t, err)
	require.NotNil(t, obj)
	require.True(t, accessClient.checkCalled, "Check should be called for users.permissions:read")
	require.False(t, accessClient.batchCheckCalled, "BatchCheck should not be called when user has users.permissions:read")
	require.False(t, fakeParentProvider.getParentCalled, "GetParent should not be called when user has users.permissions:read")
	filtered, ok := obj.(*iamv0.ResourcePermissionList)
	require.True(t, ok)
	require.Len(t, filtered.Items, 3, "all 3 items should be returned when user has users.permissions:read")
}

func TestResourcePermissions_beforeWrite(t *testing.T) {
	// In this test, we verify that beforeWrite calls accessClient.Check with the correct parameters
	fold1 := newResourcePermission("folder.grafana.app", "folders", "fold-1")

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
			parent := "fold-1"
			checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				require.NotNil(t, id)
				// Check is called with the user's identity
				require.Equal(t, "user:u001", id.GetUID())
				require.Equal(t, "org-2", id.GetNamespace())
				// Check the request values
				require.Equal(t, "org-2", req.Namespace)
				require.Equal(t, fold1.Spec.Resource.ApiGroup, req.Group)
				require.Equal(t, fold1.Spec.Resource.Resource, req.Resource)
				require.Equal(t, fold1.Spec.Resource.Name, req.Name)
				require.Equal(t, utils.VerbSetPermissions, req.Verb)
				require.Equal(t, parent, folder)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			getParentFunc := func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
				return parent, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			fakeParentProvider := &fakeParentProvider{hasParent: true, getParentFunc: getParentFunc}
			resPermAuthz := NewResourcePermissionsAuthorizer(accessClient, fakeParentProvider)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := resPermAuthz.beforeWrite(ctx, fold1)
			if tt.shouldAllow {
				require.NoError(t, err, "expected no error for allowed delete")
			} else {
				require.Error(t, err, "expected error for denied delete")
				require.True(t, k8serrors.IsForbidden(err), "expected 403 for unauthorized write operations")
			}
			require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
			require.True(t, fakeParentProvider.getParentCalled, "parentProvider.GetParent should be called")
		})
	}
}

type fakeParentProvider struct {
	hasParent       bool
	getParentCalled bool
	getParentFunc   func(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error)
}

func (f *fakeParentProvider) HasParent(gr schema.GroupResource) bool {
	return f.hasParent
}

func (f *fakeParentProvider) GetParent(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
	f.getParentCalled = true
	return f.getParentFunc(ctx, gr, namespace, name)
}
