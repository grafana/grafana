package rpclient

import (
	"context"
	"errors"
	"testing"
	"time"

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

type recordingNamespaceableClient struct {
	dynamic.NamespaceableResourceInterface
	ctx context.Context
}

func (c *recordingNamespaceableClient) Namespace(namespace string) dynamic.ResourceInterface {
	return &recordingResourceClient{ResourceInterface: c.NamespaceableResourceInterface.Namespace(namespace), parent: c}
}

type recordingResourceClient struct {
	dynamic.ResourceInterface
	parent *recordingNamespaceableClient
}

func (c *recordingResourceClient) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	c.parent.ctx = ctx
	return c.ResourceInterface.Get(ctx, name, options, subresources...)
}

func (c *recordingResourceClient) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	c.parent.ctx = ctx
	return c.ResourceInterface.Create(ctx, obj, options, subresources...)
}

func (c *recordingResourceClient) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	c.parent.ctx = ctx
	return c.ResourceInterface.Update(ctx, obj, options, subresources...)
}

func (c *recordingResourceClient) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	c.parent.ctx = ctx
	return c.ResourceInterface.Delete(ctx, name, options, subresources...)
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

func TestPermissions_SetDefault(t *testing.T) {
	const namespace = "stacks-2"
	defaults := []iamv0.ResourcePermissionspecPermission{{
		Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole,
		Name: "Viewer",
		Verb: "view",
	}}

	t.Run("creates with the target and caller grants", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		recording := &recordingNamespaceableClient{NamespaceableResourceInterface: client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource())}
		p := New(Static(recording), testGR)
		require.NoError(t, p.SetDefault(context.Background(), namespace, "thing-1", defaults))
		require.True(t, identity.IsServiceIdentity(recording.ctx))
		requester, err := identity.GetRequester(recording.ctx)
		require.NoError(t, err)
		require.Equal(t, int64(1), requester.GetOrgID())
		created, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "thing-1"), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, Name(testGR, "thing-1"), created.GetName())
		require.Equal(t, namespace, created.GetNamespace())
		apiGroup, found, err := unstructured.NestedString(created.Object, "spec", "resource", "apiGroup")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, "test.grafana.app", apiGroup)
		resource, found, err := unstructured.NestedString(created.Object, "spec", "resource", "resource")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, "things", resource)
		grants, _, err := unstructured.NestedSlice(created.Object, "spec", "permissions")
		require.NoError(t, err)
		require.Equal(t, []any{map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"}}, grants)
	})

	t.Run("replaces spec and preserves desired metadata", func(t *testing.T) {
		client := newPermissionsClient(namespace, "thing-1")
		stored, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "thing-1"), metav1.GetOptions{})
		require.NoError(t, err)
		stored.SetResourceVersion("17")
		stored.SetUID("object-uid")
		stored.SetCreationTimestamp(metav1.NewTime(time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)))
		stored.SetLabels(map[string]string{"stale": "label"})
		stored.SetAnnotations(map[string]string{"stale": "annotation"})
		stored.SetFinalizers([]string{"protect-cleanup"})
		stored.SetOwnerReferences([]metav1.OwnerReference{{APIVersion: "v1", Kind: "ConfigMap", Name: "owner", UID: "owner-uid"}})
		stored.Object["spec"] = map[string]any{
			"resource":    map[string]any{"apiGroup": "stale.group", "resource": "stale", "name": "stale"},
			"permissions": []any{map[string]any{"kind": "User", "name": "stale-user", "verb": "admin"}},
			"unexpected":  "stale",
		}
		_, err = client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Update(context.Background(), stored, metav1.UpdateOptions{})
		require.NoError(t, err)
		p := New(staticClient(client), testGR)
		require.NoError(t, p.SetDefault(context.Background(), namespace, "thing-1", defaults))
		updated, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "thing-1"), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "17", updated.GetResourceVersion())
		require.Equal(t, "object-uid", string(updated.GetUID()))
		require.Equal(t, stored.GetCreationTimestamp(), updated.GetCreationTimestamp())
		require.Empty(t, updated.GetFinalizers())
		require.Empty(t, updated.GetOwnerReferences())
		require.Empty(t, updated.GetLabels())
		require.Empty(t, updated.GetAnnotations())
		require.Equal(t, map[string]any{
			"resource":    map[string]any{"apiGroup": testGR.Group, "resource": testGR.Resource, "name": "thing-1"},
			"permissions": []any{map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"}},
		}, updated.Object["spec"])
	})

	t.Run("rejects a terminating resource permission without writing", func(t *testing.T) {
		client := newPermissionsClient(namespace, "thing-1")
		stored, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "thing-1"), metav1.GetOptions{})
		require.NoError(t, err)
		deletionTimestamp := metav1.NewTime(time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC))
		stored.SetDeletionTimestamp(&deletionTimestamp)
		stored.SetFinalizers([]string{"protect-cleanup"})
		_, err = client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Update(context.Background(), stored, metav1.UpdateOptions{})
		require.NoError(t, err)
		client.ClearActions()

		p := New(staticClient(client), testGR)
		err = p.SetDefault(context.Background(), namespace, "thing-1", defaults)
		require.EqualError(t, err, "resource permission stacks-2/test.grafana.app-things-thing-1 is terminating")
		actions := client.Actions()
		require.Len(t, actions, 1)
		require.Equal(t, "get", actions[0].GetVerb())
		unchanged, err := client.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace).
			Get(context.Background(), Name(testGR, "thing-1"), metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, unchanged.GetDeletionTimestamp())
		require.True(t, deletionTimestamp.Time.Equal(unchanged.GetDeletionTimestamp().Time))
		require.Equal(t, []string{"protect-cleanup"}, unchanged.GetFinalizers())
	})

	t.Run("does not create after another get failure", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		client.PrependReactor("get", "resourcepermissions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("IAM unavailable")
		})
		p := New(staticClient(client), testGR)
		require.Error(t, p.SetDefault(context.Background(), namespace, "thing-1", defaults))
		require.Len(t, client.Actions(), 1)
		require.Equal(t, "get", client.Actions()[0].GetVerb())
	})

	t.Run("create failure is returned", func(t *testing.T) {
		client := newPermissionsClient(namespace)
		client.PrependReactor("create", "resourcepermissions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("write failed")
		})
		p := New(staticClient(client), testGR)
		require.Error(t, p.SetDefault(context.Background(), namespace, "thing-1", defaults))
	})
	t.Run("update failure is returned", func(t *testing.T) {
		client := newPermissionsClient(namespace, "thing-1")
		client.PrependReactor("update", "resourcepermissions", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("write failed")
		})
		p := New(staticClient(client), testGR)
		require.Error(t, p.SetDefault(context.Background(), namespace, "thing-1", defaults))
	})
}
