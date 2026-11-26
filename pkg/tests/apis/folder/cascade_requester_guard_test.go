package folder

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFolderCascadeRequesterIsServerOwned(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController},
	})
	ctx := t.Context()
	forged := map[string]any{"sub": "user:1", "identifier": "forged", "type": "user"}
	withForgedRequester := func(f *unstructured.Unstructured) *unstructured.Unstructured {
		f = f.DeepCopy()
		require.NoError(t, unstructured.SetNestedField(f.Object, forged, "status", "cascadeDelete", "requester"))
		require.NoError(t, unstructured.SetNestedField(f.Object, "InProgress", "status", "cascadeDelete", "state"))
		return f
	}
	requesterOf := func(t *testing.T, c *apis.K8sResourceClient, name string) any {
		got, err := c.Resource.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err)
		v, _, err := unstructured.NestedFieldNoCopy(got.Object, "status", "cascadeDelete", "requester")
		require.NoError(t, err)
		return v
	}

	for name, user := range map[string]apis.User{"admin": helper.Org1.Admin, "editor": helper.Org1.Editor} {
		t.Run(name, func(t *testing.T) {
			client := helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
			ok := func(err error) { // a forbidden write is as good as a dropped field
				if err != nil {
					require.Contains(t, err.Error(), "forbidden")
				}
			}

			t.Run("create", func(t *testing.T) {
				_, err := client.Resource.Create(ctx, withForgedRequester(newFolderObject(gvr.GroupVersion().String(), "guard-create-"+name)), metav1.CreateOptions{})
				require.NoError(t, err)
				require.Nil(t, requesterOf(t, client, "guard-create-"+name))
			})

			created, err := client.Resource.Create(ctx, newFolderObject(gvr.GroupVersion().String(), "guard-"+name), metav1.CreateOptions{})
			require.NoError(t, err)

			t.Run("update of the main resource", func(t *testing.T) {
				_, err := client.Resource.Update(ctx, withForgedRequester(created), metav1.UpdateOptions{})
				ok(err)
				require.Nil(t, requesterOf(t, client, "guard-"+name))
			})

			t.Run("update of the status subresource", func(t *testing.T) {
				cur, err := client.Resource.Get(ctx, "guard-"+name, metav1.GetOptions{})
				require.NoError(t, err)
				_, err = client.Resource.UpdateStatus(ctx, withForgedRequester(cur), metav1.UpdateOptions{})
				ok(err)
				require.Nil(t, requesterOf(t, client, "guard-"+name))
			})

			t.Run("patch of the status subresource", func(t *testing.T) {
				patch := []byte(`{"status":{"cascadeDelete":{"state":"InProgress","requester":{"sub":"user:1","identifier":"forged","type":"user"}}}}`)
				_, err := client.Resource.Patch(ctx, "guard-"+name, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
				ok(err)
				require.Nil(t, requesterOf(t, client, "guard-"+name))
			})
		})
	}
}
