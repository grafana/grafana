package folder

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFolderCascadeRecordsRequesterInStatus(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController},
	})
	client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
	ctx := t.Context()

	_, err := client.Resource.Create(ctx, newFolderObject(gvr.GroupVersion().String(), "req-root"), metav1.CreateOptions{})
	require.NoError(t, err)

	// No controller runs, so the folder stays terminating and its status can be read.
	zero := int64(0)
	require.NoError(t, client.Resource.Delete(ctx, "req-root", metav1.DeleteOptions{GracePeriodSeconds: &zero}))

	got, err := client.Resource.Get(ctx, "req-root", metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, got.GetDeletionTimestamp())
	requester, found, err := unstructured.NestedMap(got.Object, "status", "cascadeDelete", "requester")
	require.NoError(t, err)
	require.True(t, found, "status.cascadeDelete.requester is recorded")
	require.Equal(t, "user", requester["type"])
	require.Equal(t, helper.Org1.Admin.Identity.GetIdentifier(), requester["identifier"])
	require.Equal(t, helper.Org1.Admin.Identity.GetSubject(), requester["sub"])
}
