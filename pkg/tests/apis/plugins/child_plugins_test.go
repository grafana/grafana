package plugins

import (
	"context"
	"fmt"
	"path/filepath"
	goruntime "runtime"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	grafanafs "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	parentPluginID = "myorgid-simple-app"
	childPluginID  = "myorgid-simple-panel"
	staleChildID   = "myorgid-simple-panel-stale"
)

func TestIntegrationPluginChildren(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithChildPlugin(t)
	ctx := context.Background()
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvrPlugins,
	})

	parent := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
		"apiVersion": "plugins.grafana.app/v0alpha1",
		"kind": "Plugin",
		"metadata": {"name": "%s"},
		"spec": {"id": "%s", "version": "1.0.0"}
	}`, parentPluginID, parentPluginID))
	created, err := client.Resource.Create(ctx, parent, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	child, err := client.Resource.Get(ctx, childPluginID, metav1.GetOptions{})
	require.NoError(t, err)
	requireChildPlugin(t, child, "1.0.0")

	updatedParent := created.DeepCopy()
	updatedParent.Object["spec"] = map[string]interface{}{
		"id":      parentPluginID,
		"version": "2.0.0",
	}
	_, err = client.Resource.Update(ctx, updatedParent, metav1.UpdateOptions{})
	require.NoError(t, err)

	child, err = client.Resource.Get(ctx, childPluginID, metav1.GetOptions{})
	require.NoError(t, err)
	requireChildPlugin(t, child, "2.0.0")

	// Stale-child cleanup: a child this parent owns (matched by the parent-id
	// label) that is no longer in the parent's desired set must be reaped on the
	// next parent update. Seed a rogue child carrying the parent-id label, then
	// update the parent and confirm the rogue is deleted while the legitimate
	// child survives.
	staleChild := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
		"apiVersion": "plugins.grafana.app/v0alpha1",
		"kind": "Plugin",
		"metadata": {"name": "%s", "labels": {"plugins.grafana.app/parent-id": "%s"}},
		"spec": {"id": "%s", "version": "2.0.0", "parentId": "%s"}
	}`, staleChildID, parentPluginID, staleChildID, parentPluginID))
	_, err = client.Resource.Create(ctx, staleChild, metav1.CreateOptions{})
	require.NoError(t, err)

	currentParent, err := client.Resource.Get(ctx, parentPluginID, metav1.GetOptions{})
	require.NoError(t, err)
	currentParent.Object["spec"] = map[string]interface{}{
		"id":      parentPluginID,
		"version": "3.0.0",
	}
	_, err = client.Resource.Update(ctx, currentParent, metav1.UpdateOptions{})
	require.NoError(t, err)

	_, err = client.Resource.Get(ctx, staleChildID, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "expected stale child not in the desired set to be deleted, got %v", err)

	child, err = client.Resource.Get(ctx, childPluginID, metav1.GetOptions{})
	require.NoError(t, err)
	requireChildPlugin(t, child, "3.0.0")

	require.NoError(t, client.Resource.Delete(ctx, parentPluginID, metav1.DeleteOptions{}))

	_, err = client.Resource.Get(ctx, childPluginID, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "expected child plugin to be deleted, got %v", err)
}

func requireChildPlugin(t *testing.T, child *unstructured.Unstructured, version string) {
	t.Helper()

	spec, ok := child.Object["spec"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, childPluginID, spec["id"])
	require.Equal(t, version, spec["version"])
	require.Equal(t, parentPluginID, spec["parentId"])

	annotations := child.GetAnnotations()
	require.Equal(t, "child-plugin", annotations["plugins.grafana.app/install-source"])

	labels := child.GetLabels()
	require.Equal(t, parentPluginID, labels["plugins.grafana.app/parent-id"], "child must carry parent-id label")
	require.Empty(t, child.GetOwnerReferences(), "child must not carry owner references")
}

func setupHelperWithChildPlugin(t *testing.T) *apis.K8sTestHelper {
	t.Helper()

	baseOpts := testinfra.GrafanaOpts{
		AppModeProduction:      true,
		DisableAnonymous:       true,
		APIServerRuntimeConfig: "plugins.grafana.app/v0alpha1=true",
		EnableFeatureToggles: []string{
			featuremgmt.FlagPluginStoreServiceLoading,
		},
	}

	dir, cfgPath := testinfra.CreateGrafDir(t, baseOpts)

	_, thisFile, _, ok := goruntime.Caller(0)
	require.True(t, ok)
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..")
	pluginSrc := filepath.Join(repoRoot, "pkg", "plugins", "manager", "testdata", "app-with-child")
	pluginDst := filepath.Join(dir, "plugins", "app-with-child")
	require.NoError(t, grafanafs.CopyRecursive(pluginSrc, pluginDst))

	helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
		GrafanaOpts: testinfra.GrafanaOpts{
			Dir:     dir,
			DirPath: cfgPath,
		},
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}
