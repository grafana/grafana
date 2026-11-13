package datasource

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	testdataGroup   = "grafana-testdata-datasource.datasource.grafana.app"
	testdataVersion = "v0alpha1"
)

// TestIntegrationDataSourceAnnotations covers metadata.annotations surviving the
// legacy SQL store: the datasources endpoints, the writers that know nothing about
// annotations, and the cross-type connections endpoint.
func TestIntegrationDataSourceAnnotations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagDatasourceUseNewCRUDAPIs,
			featuremgmt.FlagQueryServiceWithConnections, // the cross-type /connections route
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			// Mode 2 reads legacy, so every assertion here is against the SQL row.
			"datasources.grafana-testdata-datasource.datasource.grafana.app": {
				DualWriterMode: grafanarest.Mode2,
			},
		},
	})

	client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
		Group:    testdataGroup,
		Version:  testdataVersion,
		Resource: "datasources",
	}).Namespace("default")

	// Terraform is used throughout because a user may assign it. A repo manager is
	// reserved for the provisioning service, which is asserted separately below.
	terraform := map[string]any{
		utils.AnnoKeyManagerKind:        string(utils.ManagerKindTerraform),
		utils.AnnoKeyManagerIdentity:    "terraform-provider",
		utils.AnnoKeyManagerAllowsEdits: "true",
		utils.AnnoKeySourcePath:         "datasources/testdata.tf",
	}

	newDataSource := func(name string, annotations map[string]any) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": testdataGroup + "/" + testdataVersion,
			"kind":       "DataSource",
			"metadata": map[string]any{
				"name":        name,
				"annotations": annotations,
			},
			"spec": map[string]any{"title": name},
		}}
	}

	created, err := client.Create(ctx, newDataSource("managed", terraform), metav1.CreateOptions{})
	require.NoError(t, err)

	t.Run("create returns the annotations it was given", func(t *testing.T) {
		require.Equal(t, string(utils.ManagerKindTerraform), created.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, "terraform-provider", created.GetAnnotations()[utils.AnnoKeyManagerIdentity])
		require.Equal(t, "true", created.GetAnnotations()[utils.AnnoKeyManagerAllowsEdits])
		require.Equal(t, "datasources/testdata.tf", created.GetAnnotations()[utils.AnnoKeySourcePath])
	})

	t.Run("get resolves them as manager and source properties", func(t *testing.T) {
		out, err := client.Get(ctx, "managed", metav1.GetOptions{})
		require.NoError(t, err)

		meta, err := utils.MetaAccessor(out)
		require.NoError(t, err)

		manager, managed := meta.GetManagerProperties()
		require.True(t, managed)
		require.Equal(t, utils.ManagerProperties{
			Kind:        utils.ManagerKindTerraform,
			Identity:    "terraform-provider",
			AllowsEdits: true,
		}, manager)

		source, hasSource := meta.GetSourceProperties()
		require.True(t, hasSource)
		require.Equal(t, "datasources/testdata.tf", source.Path)
	})

	t.Run("list carries them too", func(t *testing.T) {
		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		found := false
		for _, item := range list.Items {
			if item.GetName() == "managed" {
				found = true
				require.Equal(t, "terraform-provider", item.GetAnnotations()[utils.AnnoKeyManagerIdentity])
			}
		}
		require.True(t, found, "the managed datasource is in the list")
	})

	t.Run("an unmanaged datasource carries no manager annotations", func(t *testing.T) {
		out, err := client.Create(ctx, newDataSource("plain", nil), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotContains(t, out.GetAnnotations(), utils.AnnoKeyManagerKind)
		require.NotContains(t, out.GetAnnotations(), utils.AnnoKeyManagerIdentity)

		meta, err := utils.MetaAccessor(out)
		require.NoError(t, err)
		_, managed := meta.GetManagerProperties()
		require.False(t, managed)
	})

	t.Run("the legacy HTTP API preserves annotations it cannot see", func(t *testing.T) {
		// /api/datasources has no notion of annotations -- they are json:"-" on the
		// command -- so an edit through it must not release a provisioned datasource
		// by omission. It binds the body straight to UpdateDataSourceCommand, so the
		// payload is the legacy shape rather than the k8s one.
		body, err := json.Marshal(map[string]any{
			"name":   "managed-renamed",
			"type":   "grafana-testdata-datasource",
			"access": "proxy",
		})
		require.NoError(t, err)

		update := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPut,
			Path:   "/api/datasources/uid/managed",
			Body:   body,
		}, &map[string]any{})
		require.Equal(t, http.StatusOK, update.Response.StatusCode, string(update.Body))

		out, err := client.Get(ctx, "managed", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "terraform-provider", out.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"the annotation-blind writer kept the manager")
		require.Equal(t, "datasources/testdata.tf", out.GetAnnotations()[utils.AnnoKeySourcePath])

		ds, err := datasourceV0alpha1.FromUnstructured(out)
		require.NoError(t, err)
		require.Equal(t, "managed-renamed", ds.Spec.Title(), "and did apply its own change")
	})

	t.Run("the manager is immutable", func(t *testing.T) {
		current, err := client.Get(ctx, "managed", metav1.GetOptions{})
		require.NoError(t, err)

		moved := current.DeepCopy()
		annotations := moved.GetAnnotations()
		annotations[utils.AnnoKeyManagerIdentity] = "another-provider"
		moved.SetAnnotations(annotations)

		_, err = client.Update(ctx, moved, metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
	})

	t.Run("a user may not claim a repository manager", func(t *testing.T) {
		// Repo-managed writes belong to the provisioning service; unified storage
		// re-routes them to git and SQL has nowhere to route them.
		_, err := client.Create(ctx, newDataSource("repo-managed", map[string]any{
			utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
			utils.AnnoKeyManagerIdentity: "some-repo",
		}), metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
	})

	t.Run("connections lists the datasource but carries no annotations", func(t *testing.T) {
		// DataSourceConnection has title/name/group/plugin/labels and no annotations
		// field at all, so the cross-type index cannot report a manager today.
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/query.grafana.app/v0alpha1/namespaces/default/connections",
		}, &datasourceV0alpha1.DataSourceConnectionList{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))

		names := map[string]bool{}
		for _, item := range rsp.Result.Items {
			names[item.Name] = true
		}
		require.True(t, names["managed"], "the managed datasource is listed")
		require.True(t, names["plain"], "the unmanaged one is too")

		// Pin the gap: nothing in the payload mentions a manager.
		require.NotContains(t, string(rsp.Body), utils.AnnoKeyManagerKind)
		require.NotContains(t, string(rsp.Body), "terraform-provider")
	})

	t.Run("delete is gated by the manager too", func(t *testing.T) {
		require.NoError(t, client.Delete(ctx, "plain", metav1.DeleteOptions{}))
		// Terraform allows edits, so its own delete goes through.
		require.NoError(t, client.Delete(ctx, "managed", metav1.DeleteOptions{}))
	})
}
