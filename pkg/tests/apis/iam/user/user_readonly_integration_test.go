package user

import (
	"context"
	"fmt"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUsersReadOnly(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:      false,
		DisableAnonymous:       true,
		RBACSingleOrganization: true,
		APIServerStorageType:   "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"users.iam.grafana.app": {
				DualWriterMode: rest.Mode0,
			},
		},
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesUsersReadApi,
			featuremgmt.FlagKubernetesTeamsApi,
		},
	})
	t.Cleanup(func() {
		helper.Shutdown()
	})

	ctx := context.Background()
	userClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrUsers,
	})

	// Users created by the test helper through the legacy user service.
	list, err := userClient.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, list.Items)
	existing := list.Items[0]

	t.Run("discovery only advertises read verbs", func(t *testing.T) {
		resources, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion(gvrUsers.GroupVersion().String())
		require.NoError(t, err)

		var verbs []string
		var hasStatus bool
		for _, r := range resources.APIResources {
			switch r.Name {
			case "users":
				verbs = r.Verbs
			case "users/status":
				hasStatus = true
			}
		}
		slices.Sort(verbs)
		require.Equal(t, []string{"get", "list", "watch"}, verbs)
		require.False(t, hasStatus, "status subresource should not be registered")
	})

	t.Run("get returns the user", func(t *testing.T) {
		fetched, err := userClient.Resource.Get(ctx, existing.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, existing.GetName(), fetched.GetName())
	})

	t.Run("search returns users", func(t *testing.T) {
		res := searchUsers(t, helper, "")
		require.NotEmpty(t, res.Hits)
	})

	t.Run("teams subresource is readable", func(t *testing.T) {
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams", existing.GetName()),
		}, &map[string]any{})
		require.Equal(t, 200, rsp.Response.StatusCode)
	})

	t.Run("create is not allowed", func(t *testing.T) {
		_, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("update is not allowed", func(t *testing.T) {
		toUpdate := existing.DeepCopy()
		toUpdate.Object["spec"].(map[string]any)["title"] = "Updated"
		_, err := userClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("patch is not allowed", func(t *testing.T) {
		_, err := userClient.Resource.Patch(ctx, existing.GetName(), types.MergePatchType, []byte(`{"spec":{"title":"Patched"}}`), metav1.PatchOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("delete is not allowed", func(t *testing.T) {
		err := userClient.Resource.Delete(ctx, existing.GetName(), metav1.DeleteOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)

		_, err = userClient.Resource.Get(ctx, existing.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
	})

	t.Run("status subresource is not served", func(t *testing.T) {
		_, err := userClient.Resource.UpdateStatus(ctx, existing.DeepCopy(), metav1.UpdateOptions{})
		require.True(t, errors.IsNotFound(err), "unexpected error: %v", err)
	})
}
