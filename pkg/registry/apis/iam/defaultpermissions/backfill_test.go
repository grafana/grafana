package defaultpermissions

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func testObjInFolder(t *testing.T, name, namespace, folderUID string) utils.GrafanaMetaAccessor {
	t.Helper()
	meta := testObj(t, name, namespace)
	if folderUID != "" {
		meta.SetFolder(folderUID)
	}
	return meta
}

func TestBackfill(t *testing.T) {
	ctx := context.Background()
	// Backfill is not "creating" anything, so the actor it records should not be treated
	// as a creator warranting an admin grant. nil stands in for a non-user/service-account
	// identity here since this test's BuildDefaults ignores its argument entirely.
	var serviceIdentity authlib.AuthInfo

	cfg := func(getter ClientGetter) Config {
		return Config{
			GVR:           testGVR,
			Client:        getter,
			BuildDefaults: func(authlib.AuthInfo) []Permission { return testDefaults },
		}
	}

	t.Run("grants defaults to root resources and skips nested ones", func(t *testing.T) {
		dyn, getter := newFakeClient()
		lister := func(context.Context, string) ([]utils.GrafanaMetaAccessor, error) {
			return []utils.GrafanaMetaAccessor{
				testObjInFolder(t, "root-one", "default", ""),
				testObjInFolder(t, "nested-one", "default", "some-folder"),
				testObjInFolder(t, "root-two", "default", "general"),
			}, nil
		}

		fixed, err := Backfill(ctx, cfg(getter), lister, "default", serviceIdentity)
		require.NoError(t, err)
		require.Equal(t, 2, fixed)

		gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}
		for _, name := range []string{"dashboard.grafana.app-dashboards-root-one", "dashboard.grafana.app-dashboards-root-two"} {
			_, err := dyn.Resource(gvr).Namespace("default").Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "expected a ResourcePermission for %s", name)
		}
		_, err = dyn.Resource(gvr).Namespace("default").Get(ctx, "dashboard.grafana.app-dashboards-nested-one", metav1.GetOptions{})
		require.Error(t, err, "nested resource should not have been touched")
	})

	t.Run("is a no-op for a root resource that already has the defaults", func(t *testing.T) {
		existing := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind":       "ResourcePermission",
			"metadata": map[string]any{
				"name":      "dashboard.grafana.app-dashboards-already-fixed",
				"namespace": "default",
			},
			"spec": map[string]any{
				"resource": map[string]any{
					"apiGroup": testGVR.Group,
					"resource": testGVR.Resource,
					"name":     "already-fixed",
				},
				"permissions": []any{
					map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
					map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
				},
			},
		}}
		dyn, getter := newFakeClient(existing)
		lister := func(context.Context, string) ([]utils.GrafanaMetaAccessor, error) {
			return []utils.GrafanaMetaAccessor{testObjInFolder(t, "already-fixed", "default", "")}, nil
		}

		fixed, err := Backfill(ctx, cfg(getter), lister, "default", serviceIdentity)
		require.NoError(t, err)
		require.Equal(t, 1, fixed) // processed, but a no-op change

		gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}
		got, err := dyn.Resource(gvr).Namespace("default").Get(ctx, "dashboard.grafana.app-dashboards-already-fixed", metav1.GetOptions{})
		require.NoError(t, err)
		perms, _, err := unstructured.NestedSlice(got.Object, "spec", "permissions")
		require.NoError(t, err)
		require.Len(t, perms, 2, "re-running Backfill must not duplicate entries")
	})

	t.Run("propagates a lister error", func(t *testing.T) {
		_, getter := newFakeClient()
		listErr := errors.New("boom")
		lister := func(context.Context, string) ([]utils.GrafanaMetaAccessor, error) {
			return nil, listErr
		}

		_, err := Backfill(ctx, cfg(getter), lister, "default", serviceIdentity)
		require.ErrorIs(t, err, listErr)
	})
}
