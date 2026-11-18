package manifestkinds

import (
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_ManifestKind verifies that a kind is provisionable when its app
// manifest opts in, with no entry in the [provisioning] resources config.
func TestIntegrationProvisioning_ManifestKind(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t, featuremgmt.FlagGrafanaUseRouterMiddleware)

	t.Run("settings list the kind that the manifest enables", func(t *testing.T) {
		// The manifests are read in the background, after the router publishes them.
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			settings := &provisioning.RepositoryViewList{}
			result := helper.AdminREST.Get().Namespace("default").Resource("settings").Do(t.Context())
			if !assert.NoError(collect, result.Error()) || !assert.NoError(collect, result.Into(settings)) {
				return
			}
			assert.Contains(collect, settings.AvailableResources, provisioning.SupportedResource{Group: testAppGroup, Kind: "Thing"})
			assert.NotContains(collect, settings.AvailableResources, provisioning.SupportedResource{Group: testAppGroup, Kind: "Widget"})
		}, 60*time.Second, 500*time.Millisecond)
	})

	t.Run("sync creates the resources of the kind", func(t *testing.T) {
		const repo = "manifest-kind-repo"
		helper.CreateLocalRepo(t, common.TestRepo{Name: repo, SyncTarget: "folder"})
		helper.WriteToProvisioningPath(t, "thing-1.json", common.ResourceToJSON(t, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": testAppGroup + "/v1",
			"kind":       "Thing",
			"metadata":   map[string]any{"name": "thing-1"},
			"spec":       map[string]any{"foo": "from the repository"},
		}}))

		helper.SyncAndWait(t, repo, nil)

		got := common.RequireResource(t, thingsClient(t, helper), "thing-1")
		foo, _, _ := unstructured.NestedString(got.Object, "spec", "foo")
		require.Equal(t, "from the repository", foo)
		require.Equal(t, repo, got.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})
}

// Without the router middleware, Grafana does not serve the groups of the app plugins. A kind of
// a manifest is then not provisionable, because no export or sync can reach it.
func TestIntegrationProvisioning_ManifestKindWithoutRouterMiddleware(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)

	// The router publishes its manifests a few seconds after the start.
	require.Never(t, func() bool {
		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().Namespace("default").Resource("settings").Do(t.Context())
		return result.Error() == nil && result.Into(settings) == nil &&
			slices.Contains(settings.AvailableResources, provisioning.SupportedResource{Group: testAppGroup, Kind: "Thing"})
	}, 10*time.Second, time.Second)
}
