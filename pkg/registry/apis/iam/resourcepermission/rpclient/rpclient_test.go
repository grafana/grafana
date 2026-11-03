package rpclient

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clientrest "k8s.io/client-go/rest"
	k8stesting "k8s.io/client-go/testing"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var testGR = schema.GroupResource{Group: "test.grafana.app", Resource: "things"}

type restConfigFunc func(context.Context) (*clientrest.Config, error)

func (f restConfigFunc) GetRestConfig(ctx context.Context) (*clientrest.Config, error) { return f(ctx) }

func newPermissionsClient(namespace string, names ...string) *dynamicfake.FakeDynamicClient {
	gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
	objs := make([]runtime.Object, 0, len(names))
	for _, name := range names {
		objs = append(objs, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(),
			"kind":       iamv0.ResourcePermissionInfo.GroupVersionKind().Kind,
			"metadata":   map[string]any{"namespace": namespace, "name": Name(testGR, name)},
		}})
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: iamv0.ResourcePermissionInfo.GroupVersionKind().Kind + "List"}, objs...)
}

func permissionExists(t *testing.T, client dynamic.Interface, namespace, name string) bool {
	t.Helper()
	_, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
		Get(context.Background(), Name(testGR, name), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return false
	}
	require.NoError(t, err)
	return true
}

func staticClient(client dynamic.Interface) ClientProvider {
	return Static(client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()))
}

func TestName(t *testing.T) {
	require.Equal(t, "test.grafana.app-things-abc", Name(testGR, "abc"))
}

func TestFromRestConfig(t *testing.T) {
	calls := 0
	provider := FromRestConfig(restConfigFunc(func(context.Context) (*clientrest.Config, error) {
		calls++
		if calls == 1 {
			return nil, errors.New("not ready")
		}
		return &clientrest.Config{Host: "http://localhost"}, nil
	}))

	_, err := provider(context.Background())
	require.Error(t, err)

	client, err := provider(context.Background())
	require.NoError(t, err)
	require.NotNil(t, client)

	_, err = provider(context.Background())
	require.NoError(t, err)
	require.Equal(t, 2, calls, "the client is built once the rest config is available, then reused")
}

func TestWithCreatorAdmin(t *testing.T) {
	defaults := []iamv0.ResourcePermissionspecPermission{
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "view"},
	}

	tests := []struct {
		name    string
		creator *identity.StaticRequester
		want    []iamv0.ResourcePermissionspecPermission
	}{
		{
			name:    "user",
			creator: &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1"},
			want: append([]iamv0.ResourcePermissionspecPermission{
				{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u1", Verb: "admin"},
			}, defaults...),
		},
		{
			name:    "anonymous",
			creator: &identity.StaticRequester{Type: authlib.TypeAnonymous},
			want:    defaults,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, WithCreatorAdmin(tt.creator, defaults))
		})
	}
}

func TestPermissions_SetPermissions(t *testing.T) {
	const namespace = "stacks-2"
	perms := []iamv0.ResourcePermissionspecPermission{
		{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u1", Verb: "admin"},
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "view"},
	}
	wantSpec := map[string]any{
		"resource": map[string]any{"apiGroup": testGR.Group, "resource": testGR.Resource, "name": "uid"},
		"permissions": []any{
			map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		},
	}
	getSpec := func(t *testing.T, client dynamic.Interface) any {
		t.Helper()
		obj, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "uid"), metav1.GetOptions{})
		require.NoError(t, err)
		return obj.Object["spec"]
	}

	t.Run("creates a missing resource permission", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		p := New(staticClient(client), testGR)

		require.NoError(t, p.SetPermissions(context.Background(), namespace, "uid", perms))
		require.Equal(t, wantSpec, getSpec(t, client))
	})

	t.Run("replaces an existing resource permission", func(t *testing.T) {
		client := newPermissionsClient(namespace, "uid")
		p := New(staticClient(client), testGR)

		require.NoError(t, p.SetPermissions(context.Background(), namespace, "uid", perms))
		require.Equal(t, wantSpec, getSpec(t, client))
	})

	t.Run("a get failure is returned without creating", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		client.PrependReactor("get", "resourcepermissions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("iam unavailable")
		})
		p := New(staticClient(client), testGR)

		require.Error(t, p.SetPermissions(context.Background(), namespace, "uid", perms))
		require.Len(t, client.Actions(), 1)
	})
}

func TestPermissions_DeletePermissions(t *testing.T) {
	const namespace = "stacks-2"

	t.Run("deletes the resource permission in the namespace only", func(t *testing.T) {
		client := newPermissionsClient(namespace, "uid", "other")
		other := newPermissionsClient("stacks-1", "uid")
		p := New(staticClient(client), testGR)

		require.NoError(t, p.DeletePermissions(context.Background(), namespace, "uid"))
		require.NoError(t, p.DeletePermissions(context.Background(), "stacks-3", "uid"))

		require.False(t, permissionExists(t, client, namespace, "uid"))
		require.True(t, permissionExists(t, client, namespace, "other"))
		require.True(t, permissionExists(t, other, "stacks-1", "uid"))
	})

	t.Run("a missing permission is a no-op", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		p := New(staticClient(client), testGR)

		require.NoError(t, p.DeletePermissions(context.Background(), namespace, "gone"))
		require.Len(t, client.Actions(), 1)
	})

	t.Run("failures are returned", func(t *testing.T) {
		client := newPermissionsClient(namespace, "uid")
		client.PrependReactor("delete", "resourcepermissions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("iam unavailable")
		})
		providers := map[string]ClientProvider{
			"delete fails": staticClient(client),
			"client build fails": func(context.Context) (dynamic.NamespaceableResourceInterface, error) {
				return nil, errors.New("no rest config")
			},
			"client not configured": Static(nil),
		}
		for name, provider := range providers {
			t.Run(name, func(t *testing.T) {
				p := New(provider, testGR)
				require.Error(t, p.DeletePermissions(context.Background(), namespace, "uid"))
			})
		}
		require.True(t, permissionExists(t, client, namespace, "uid"))
	})
}
