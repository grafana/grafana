package folder

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFolderCreateParentLookup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})
	client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
	newFolder := func(name, parent string) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]any{
				"name":        name,
				"namespace":   client.Args.Namespace,
				"annotations": map[string]any{utils.AnnoKeyFolder: parent},
			},
			"spec": map[string]any{"title": name},
		}}
	}

	// Seed a broken historical chain below admission so the create API can be
	// tested against an existing parent whose ancestor has disappeared.
	data, err := json.Marshal(newFolder("detached-parent", "missing"))
	require.NoError(t, err)
	ctx, _, err := identity.WithProvisioningIdentity(t.Context(), client.Args.Namespace)
	require.NoError(t, err)
	resp, err := helper.GetEnv().ResourceClient.Create(ctx, &resourcepb.CreateRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: client.Args.Namespace,
			Group:     gvr.Group,
			Resource:  gvr.Resource,
			Name:      "detached-parent",
		},
		Value: data,
	})
	require.NoError(t, resource.ErrorFromResponse(resp.GetError(), err))

	for _, parent := range []string{"missing", "detached-parent"} {
		t.Run(parent, func(t *testing.T) {
			name := "child-of-" + parent
			_, err := client.Resource.Create(t.Context(), newFolder(name, parent), metav1.CreateOptions{})
			require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
			var status *apierrors.StatusError
			require.ErrorAs(t, err, &status)
			require.Equal(t, int32(http.StatusBadRequest), status.ErrStatus.Code)
			require.NotNil(t, status.ErrStatus.Details)
			require.Equal(t, "folder.bad-request", string(status.ErrStatus.Details.UID))
			_, err = client.Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "failed create must not persist an orphan")

			preview, err := client.Resource.Create(t.Context(), newFolder(name, parent), metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
			require.NoError(t, err)
			require.Equal(t, name, preview.GetName())
			_, err = client.Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "dry-run must not persist a preview")

			legacyName := "legacy-child-of-" + parent
			body, err := json.Marshal(map[string]string{"uid": legacyName, "title": legacyName, "parentUid": parent})
			require.NoError(t, err)
			legacy := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/folders",
				Body:   body,
			}, &map[string]any{})
			require.NotNil(t, legacy.Response)
			require.Equal(t, http.StatusBadRequest, legacy.Response.StatusCode)
			_, err = client.Resource.Get(t.Context(), legacyName, metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "failed legacy create must not persist an orphan")
		})
	}

	parents, err := client.Resource.Get(t.Context(), "detached-parent", metav1.GetOptions{}, "parents")
	require.NoError(t, err)
	items, found, err := unstructured.NestedSlice(parents.Object, "items")
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, items, 2)
	missing := items[0].(map[string]any)
	require.Equal(t, "missing", missing["name"])
	require.Equal(t, true, missing["detached"])
	require.Contains(t, missing["description"], "not found")

	_, err = client.Resource.Create(t.Context(), newFolder("valid-parent", ""), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Create(t.Context(), newFolder("valid-child", "valid-parent"), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Get(t.Context(), "valid-child", metav1.GetOptions{})
	require.NoError(t, err)
}
