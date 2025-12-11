package authorizer

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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
				require.Equal(t, utils.VerbGetPermissions, req.Verb)

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := resPermAuthz.AfterGet(ctx, fold1)
			if tt.shouldAllow {
				require.NoError(t, err, "expected no error for allowed access")
			} else {
				require.Error(t, err, "expected error for denied access")
			}
			require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		})
	}
}

func TestResourcePermissions_FilterList(t *testing.T) {
	// In this test, the user has permission to access only fold-1 and dash-2.
	// We verify that FilterList returns only those two objects.

	list := &iamv0.ResourcePermissionList{
		Items: []iamv0.ResourcePermission{
			*newResourcePermission("folder.grafana.app", "folders", "fold-1"),
			*newResourcePermission("folder.grafana.app", "folders", "fold-2"),
			*newResourcePermission("dashboard.grafana.app", "dashboards", "dash-2"),
		},
	}

	compileFunc := func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
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

		// Return a checker that allows only specific resources: fold-1 and dash-2
		return func(name, folder string) bool {
			if name == "fold-1" || name == "dash-2" {
				return true
			}
			return false
		}, &types.NoopZookie{}, nil
	}

	accessClient := &fakeAccessClient{compileFunc: compileFunc}
	resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
	ctx := types.WithAuthInfo(context.Background(), user)

	obj, err := resPermAuthz.FilterList(ctx, list)
	require.NoError(t, err)
	require.NotNil(t, list)
	require.True(t, accessClient.compileCalled, "accessClient.Compile should be called")

	filtered, ok := obj.(*iamv0.ResourcePermissionList)
	require.True(t, ok, "response should be of type ResourcePermissionList")
	require.Len(t, filtered.Items, 2, "response list should have 2 items after filtering")
	require.Equal(t, "fold-1", filtered.Items[0].Spec.Resource.Name)
	require.Equal(t, "dash-2", filtered.Items[1].Spec.Resource.Name)
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

				return types.CheckResponse{Allowed: tt.shouldAllow}, nil
			}

			accessClient := &fakeAccessClient{checkFunc: checkFunc}
			resPermAuthz := NewResourcePermissionsAuthorizer(accessClient)
			ctx := types.WithAuthInfo(context.Background(), user)

			err := resPermAuthz.beforeWrite(ctx, fold1)
			if tt.shouldAllow {
				require.NoError(t, err, "expected no error for allowed delete")
			} else {
				require.Error(t, err, "expected error for denied delete")
			}
			require.True(t, accessClient.checkCalled, "accessClient.Check should be called")
		})
	}
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
