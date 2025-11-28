package storewrapper

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srest "k8s.io/apiserver/pkg/registry/rest"
)

var (
	user = authn.NewIDTokenAuthInfo(
		authn.Claims[authn.AccessTokenClaims]{
			Claims: jwt.Claims{Issuer: "grafana",
				Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana"), Audience: []string{"iam.grafana.app"}},
			Rest: authn.AccessTokenClaims{
				Namespace:            "*",
				Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
				DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
			},
		}, &authn.Claims[authn.IDTokenClaims]{
			Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeUser, "u001")},
			Rest:   authn.IDTokenClaims{Namespace: "org-2", Identifier: "u001", Type: types.TypeUser},
		},
	)
)

func newResourcePermission(apiGroup, resource, name string) iamv0.ResourcePermission {
	return iamv0.ResourcePermission{
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

func TestResourcePermissions_List(t *testing.T) {
	// In this test, the user has permission to access only fold-1 and dash-2.
	// We verify that List returns only those two objects.

	inner := &fakeInnerStore{
		listResponse: &iamv0.ResourcePermissionList{
			Items: []iamv0.ResourcePermission{
				newResourcePermission("folder.grafana.app", "folders", "fold-1"),
				newResourcePermission("folder.grafana.app", "folders", "fold-2"),
				newResourcePermission("dashboard.grafana.app", "dashboards", "dash-2"),
			},
		},
	}
	accessClient := &fakeAccessClient{
		compileFunc: func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
			require.NotNil(t, id)

			// Compile is called with the user's identity
			require.Equal(t, "user:u001", id.GetUID())
			require.Equal(t, "org-2", id.GetNamespace())

			// Check the request values
			require.Equal(t, "org-2", req.Namespace)
			if req.Resource == "folders" {
				require.Equal(t, "folder.grafana.app", req.Group)
				require.Equal(t, "folders", req.Resource)
			}
			if req.Resource == "dashboards" {
				require.Equal(t, "dashboard.grafana.app", req.Group)
				require.Equal(t, "dashboards", req.Resource)
			}
			require.Equal(t, utils.VerbGetPermissions, req.Verb)

			// Return a checker that allows only specific resources: fold-1 and dash-2
			return func(name, folder string) bool {
				if name == "fold-1" || name == "dash-2" {
					return true
				}
				return false
			}, &types.NoopZookie{}, nil
		},
	}

	resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
	wrapper := New(inner, resPermAuthz)

	ctx := types.WithAuthInfo(context.Background(), user)
	list, err := wrapper.List(ctx, &internalversion.ListOptions{Limit: 10})
	require.NoError(t, err)
	require.NotNil(t, list)
	require.True(t, inner.listCalled, "inner store List should be called")
	require.True(t, accessClient.compileCalled, "accessClient.Compile should be called")

	respList, ok := list.(*iamv0.ResourcePermissionList)
	require.True(t, ok, "response should be of type ResourcePermissionList")
	require.Len(t, respList.Items, 2, "response list should have 2 items after filtering")
	require.Equal(t, "fold-1", respList.Items[0].Spec.Resource.Name)
	require.Equal(t, "dash-2", respList.Items[1].Spec.Resource.Name)
}

func TestResourcePermissions_Get(t *testing.T) {
	// In this test, the user has permission to access only fold-1 but not dash-1.
	// We verify that Get returns the correct object for fold-1 and denies access to dash-1.
	// We verify that the accessClient.Check is called with the correct parameters.

	checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
		require.NotNil(t, id)

		// Check is called with the user's identity
		require.Equal(t, "user:u001", id.GetUID())
		require.Equal(t, "org-2", id.GetNamespace())

		// Check the request values
		require.Equal(t, "org-2", req.Namespace)
		if req.Group == "folder.grafana.app" {
			require.Equal(t, "folder.grafana.app", req.Group)
			require.Equal(t, "folders", req.Resource)
			require.Equal(t, "fold-1", req.Name)
		}
		if req.Group == "dashboard.grafana.app" {
			require.Equal(t, "dashboard.grafana.app", req.Group)
			require.Equal(t, "dashboards", req.Resource)
			require.Equal(t, "dash-1", req.Name)
		}
		require.Equal(t, utils.VerbGetPermissions, req.Verb)

		// Allow access only to fold-1
		if req.Name == "fold-1" {
			return types.CheckResponse{Allowed: true}, nil
		}
		return types.CheckResponse{Allowed: false}, nil
	}

	ctx := types.WithAuthInfo(context.Background(), user)

	// First, test access to fold-1
	t.Run("access to fold-1", func(t *testing.T) {
		fold1 := newResourcePermission("folder.grafana.app", "folders", "fold-1")
		inner := &fakeInnerStore{getResponse: &fold1}
		accessClient := &fakeAccessClient{checkFunc: checkFunc}
		resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
		wrapper := New(inner, resPermAuthz)

		obj, err := wrapper.Get(ctx, "folder.grafana.app/folders/fold-1", &metav1.GetOptions{})
		require.NoError(t, err)
		require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		require.True(t, inner.getCalled, "inner store Get should be called")
		require.NotNil(t, obj)
		resp, ok := obj.(*iamv0.ResourcePermission)
		require.True(t, ok, "response should be of type ResourcePermission")
		require.Equal(t, "fold-1", resp.Spec.Resource.Name)
	})

	// Now, test access to dash-1
	t.Run("access to dash-1", func(t *testing.T) {
		dash1 := newResourcePermission("dashboard.grafana.app", "dashboards", "dash-1")
		inner := &fakeInnerStore{getResponse: &dash1}
		accessClient := &fakeAccessClient{checkFunc: checkFunc}
		resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
		wrapper := New(inner, resPermAuthz)

		obj, err := wrapper.Get(ctx, "dashboard.grafana.app/dashboards/dash-1", &metav1.GetOptions{})
		require.Error(t, err, "expected error when accessing unauthorized resource")
		require.True(t, inner.getCalled, "inner store Get should be called")
		require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		require.Nil(t, obj, "expected nil object for unauthorized access")
	})
}

func TestResourcePermissions_Delete(t *testing.T) {
	// In this test, the user has permission to delete fold-1 but not dash-1.
	// We verify that Delete succeeds for fold-1 and denies access for dash-1.

	checkFunc := func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
		// Check the request values
		require.NotNil(t, id)
		// Check is called with the user's identity
		require.Equal(t, "user:u001", id.GetUID())
		require.Equal(t, "org-2", id.GetNamespace())
		require.Equal(t, "org-2", req.Namespace)
		if req.Group == "folder.grafana.app" {
			require.Equal(t, "folder.grafana.app", req.Group)
			require.Equal(t, "folders", req.Resource)
			require.Equal(t, "fold-1", req.Name)
		}
		if req.Group == "dashboard.grafana.app" {
			require.Equal(t, "dashboard.grafana.app", req.Group)
			require.Equal(t, "dashboards", req.Resource)
			require.Equal(t, "dash-1", req.Name)
		}

		// Allow deletion only for fold-1
		if req.Name == "fold-1" {
			return types.CheckResponse{Allowed: true}, nil
		}
		return types.CheckResponse{Allowed: false}, nil
	}

	ctx := types.WithAuthInfo(context.Background(), user)

	// First, test deletion of fold-1
	t.Run("delete fold-1", func(t *testing.T) {
		fold1 := newResourcePermission("folder.grafana.app", "folders", "fold-1")
		inner := &fakeInnerStore{getResponse: &fold1, deleteResponse: &fold1, deleteStatus: true}
		accessClient := &fakeAccessClient{checkFunc: checkFunc}
		resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
		wrapper := New(inner, resPermAuthz)

		obj, deleted, err := wrapper.Delete(ctx, "folder.grafana.app/folders/fold-1", nil, &metaV1.DeleteOptions{})
		require.NoError(t, err)
		require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		require.True(t, inner.getCalled, "inner store Get should be called")
		require.True(t, inner.deleteCalled, "inner store Delete should be called")
		require.NotNil(t, obj)
		require.True(t, deleted)
		resp, ok := obj.(*iamv0.ResourcePermission)
		require.True(t, ok, "response should be of type ResourcePermission")
		require.Equal(t, "fold-1", resp.Spec.Resource.Name)
	})

	// Now, test deletion of dash-1
	t.Run("delete dash-1", func(t *testing.T) {
		dash1 := newResourcePermission("dashboard.grafana.app", "dashboards", "dash-1")
		inner := &fakeInnerStore{getResponse: &dash1}
		accessClient := &fakeAccessClient{checkFunc: checkFunc}
		resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
		wrapper := New(inner, resPermAuthz)

		obj, deleted, err := wrapper.Delete(ctx, "dashboard.grafana.app/dashboards/dash-1", nil, &metaV1.DeleteOptions{})
		require.Error(t, err, "expected error when deleting unauthorized resource")
		require.True(t, inner.getCalled, "inner store Get should be called")
		require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		require.False(t, inner.deleteCalled, "inner store Delete should not be called")
		require.Nil(t, obj, "expected nil object for unauthorized delete")
		require.False(t, deleted)
	})
}

// -----
// Fakes
// -----

type fakeInnerStore struct {
	K8sStorage

	listCalled   bool
	listResponse runtime.Object

	getCalled   bool
	getResponse runtime.Object

	deleteCalled   bool
	deleteResponse runtime.Object
	deleteStatus   bool
}

func (f *fakeInnerStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listCalled = true
	return f.listResponse, nil
}

func (f *fakeInnerStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	f.getCalled = true
	return f.getResponse, nil
}

func (f *fakeInnerStore) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	f.deleteCalled = true
	return f.deleteResponse, f.deleteStatus, nil
}

// fakeAccessClient is a mock implementation of claims.AccessClient
type fakeAccessClient struct {
	checkCalled   bool
	checkFunc     func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error)
	compileCalled bool
	compileFunc   func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error)
}

func (m *fakeAccessClient) Check(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	m.checkCalled = true
	return m.checkFunc(id, &req, folder)
}

func (m *fakeAccessClient) Compile(ctx context.Context, id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	m.compileCalled = true
	return m.compileFunc(id, req)
}

var _ types.AccessClient = (*fakeAccessClient)(nil)
