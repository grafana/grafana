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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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
	inner := &fakeInnerStore{
		listResponse: &iamv0.ResourcePermissionList{
			Items: []iamv0.ResourcePermission{
				newResourcePermission("folder.grafana.app", "folders", "fold-1"),
				newResourcePermission("folder.grafana.app", "folders", "fold-2"),
				newResourcePermission("dashboard.grafana.app", "dashboards", "dash-2"),
			},
		},
	}
	compileCalled := false
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

			// Mark that compile was called
			compileCalled = true

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
	require.True(t, compileCalled, "accessClient.Compile should be called")

	respList, ok := list.(*iamv0.ResourcePermissionList)
	require.True(t, ok, "response should be of type ResourcePermissionList")
	require.Len(t, respList.Items, 2, "response list should have 2 items after filtering")
	require.Equal(t, "fold-1", respList.Items[0].Spec.Resource.Name)
	require.Equal(t, "dash-2", respList.Items[1].Spec.Resource.Name)
}

// -----
// Fakes
// -----

type fakeInnerStore struct {
	K8sStorage

	listCalled   bool
	listResponse runtime.Object
}

func (f *fakeInnerStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listCalled = true
	return f.listResponse, nil
}

// fakeAccessClient is a mock implementation of claims.AccessClient
type fakeAccessClient struct {
	checkFunc   func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error)
	compileFunc func(id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error)
}

func (m *fakeAccessClient) Check(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	return m.checkFunc(id, &req, folder)
}

func (m *fakeAccessClient) Compile(ctx context.Context, id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	return m.compileFunc(id, req)
}

var _ types.AccessClient = (*fakeAccessClient)(nil)
