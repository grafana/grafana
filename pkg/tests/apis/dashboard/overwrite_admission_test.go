package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationDashboardOverwriteAdmission proves, end-to-end through the real
// HTTP/apiserver surface (no direct calls to internal types), that a sentinel
// resourceVersion sent on a dashboard Create request:
//  1. triggers an admission-layer rewrite that fetches the existing object and
//     re-dispatches as a synthetic Update, so real Update-flavored business
//     validation (including authorization) genuinely runs,
//  2. leaves the ordinary (non-sentinel) create-conflict behavior unchanged, and
//  3. enforces real Update-flavored authorization - a caller with create rights
//     but no update rights is rejected, which would NOT happen if only
//     Create-flavored checks ran.
func TestIntegrationDashboardOverwriteAdmission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "dashboards",
	}

	newDashboard := func(name, title string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]any{"title": title},
		}}
		obj.SetName(name)
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		return obj
	}

	t.Run("sentinel-triggered replace runs real update validation, not just create", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("admission-overwrite-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("admission-overwrite-uid", "second title")
		second.SetResourceVersion(apistore.OverwriteOnCreateResourceVersion)

		updated, err := client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "second title", updated.Object["spec"].(map[string]any)["title"])
	})

	t.Run("non-sentinel second create still 409s", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("no-admission-overwrite-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("no-admission-overwrite-uid", "second title")
		_, err = client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.True(t, errors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
	})

	t.Run("caller with create-but-not-update rights is rejected", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// A plain org Viewer has neither dashboards:create nor dashboards:write,
		// so using Org1.Viewer here would be rejected for the wrong reason: even
		// a plain (non-sentinel) create would 403 for them, which would prove
		// nothing about the update-flavored path this mechanism exists to
		// protect. Build a caller who provably holds create rights (granted
		// dashboards:create, the create-flavored RBAC action) but no write
		// rights (dashboards:write, the update-flavored action - see
		// pkg/services/accesscontrol/authorizer.go's default verb mapping:
		// VerbCreate -> "<resource>:create", VerbUpdate -> "<resource>:write").
		createOnly := helper.CreateUser("create-only-no-write", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{"dashboards:create"},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})
		createOnlyClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: createOnly,
			GVR:  gvr,
		})

		first := newDashboard("viewer-overwrite-uid", "first title")
		_, err := adminClient.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		// Sanity check: this caller really does have create rights (otherwise
		// the Forbidden below would be unrelated to the update-flavored check).
		sanity := newDashboard("create-only-sanity-uid", "sanity title")
		_, err = createOnlyClient.Resource.Create(ctx, sanity, metav1.CreateOptions{})
		require.NoError(t, err, "caller should hold create rights (dashboards:create) independent of the sentinel mechanism")

		second := newDashboard("viewer-overwrite-uid", "second title")
		second.SetResourceVersion(apistore.OverwriteOnCreateResourceVersion)

		_, err = createOnlyClient.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.True(t, errors.IsForbidden(err), "expected Forbidden, got: %v", err)
	})
}
