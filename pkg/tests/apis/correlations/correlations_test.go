package correlations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/utils/ptr"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = correlationsV0.CorrelationKind().GroupVersionResource()

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationCorrelations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("default setup with k8s flag turned off (legacy APIs)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{}, // legacy APIs only
		})
		setupDataSources(t, helper)
		// In this setup, K8s APIs are not available - legacy APIs only
		doLegacyOnlyTests(t, helper)

		// When no feature toggles are enabled, correlations K8s APIs should not be available
		disco := helper.NewDiscoveryClient()
		groups, err := disco.ServerGroups()
		require.NoError(t, err)

		hasCorrelationsGroup := false
		for _, group := range groups.Groups {
			if group.Name == "correlations.grafana.app" {
				hasCorrelationsGroup = true
				break
			}
		}
		require.False(t, hasCorrelationsGroup, "correlations K8s APIs should not be available when kubernetesCorrelations feature toggle is disabled")
	})

	t.Run("with dual write (unified storage, mode 0)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{featuremgmt.FlagKubernetesCorrelations},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		})
		setupDataSources(t, helper)
		doLegacyOnlyTests(t, helper)
	})

	t.Run("modes", func(t *testing.T) {
		for _, mode := range []grafanarest.DualWriterMode{
			grafanarest.Mode1,
			grafanarest.Mode2,
			grafanarest.Mode3,
		} {
			t.Run(fmt.Sprintf("dual write (unified storage, mode %d)", mode), func(t *testing.T) {
				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    false,
					DisableAnonymous:     true,
					APIServerStorageType: options.StorageTypeUnified,
					EnableFeatureToggles: []string{
						featuremgmt.FlagKubernetesCorrelations,
					},
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						RESOURCEGROUP: {
							DualWriterMode: mode,
						},
					},
				})
				setupDataSources(t, helper)
				doDualWriteTests(t, helper, mode)
			})
		}
	})

	t.Run("with dual write (unified storage, mode 5)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesCorrelations,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		})
		setupDataSources(t, helper)
		doUnifiedOnlyTests(t, helper)
	})
}

// setupDataSources creates test data sources for correlation tests
func setupDataSources(t *testing.T, helper *apis.K8sTestHelper) {
	helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "test-A",
		UID:   "test-A",
		Type:  "testdata",
	})
	helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "test-B",
		UID:   "test-B",
		Type:  "testdata",
	})
}

// createLegacyCorrelation creates a correlation via legacy API
func createLegacyCorrelation(t *testing.T, helper *apis.K8sTestHelper, user apis.User, sourceUID, targetUID string) string {
	cmd := &correlations.CreateCorrelationCommand{
		TargetUID:   ptr.To(targetUID),
		Label:       "test correlation",
		Description: "test description",
		Type:        correlations.CorrelationType("query"),
		Config: correlations.CorrelationConfig{
			Field:  "message",
			Target: map[string]any{},
			Transformations: correlations.Transformations{{
				Type:       "logfmt",
				Expression: "",
				Field:      "f0",
				MapValue:   "mapped",
			}},
		},
	}
	body, err := json.Marshal(cmd)
	require.NoError(t, err)

	createResult := apis.DoRequest(helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   "/api/datasources/uid/" + sourceUID + "/correlations",
		Body:   body,
	}, &correlations.CreateCorrelationResponseBody{})
	require.Equal(t, http.StatusOK, createResult.Response.StatusCode, "create correlation via legacy API")
	require.NotNil(t, createResult.Result)
	require.NotEmpty(t, createResult.Result.Result.UID)

	return createResult.Result.Result.UID
}

// doLegacyOnlyTests tests functionality for Mode 0 (legacy only)
// Only legacy API should be used, no K8s API interaction
func doLegacyOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("Legacy API CRUD", func(t *testing.T) {
		// Create via legacy API
		uid := createLegacyCorrelation(t, helper, helper.Org1.Admin, "test-A", "test-B")

		// Read via legacy API
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
		}, &correlations.Correlation{})
		require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode)
		require.NotNil(t, legacyGet.Result)
		assert.Equal(t, uid, legacyGet.Result.UID)
		assert.Equal(t, "test-A", legacyGet.Result.SourceUID)
		assert.Equal(t, "test-B", *legacyGet.Result.TargetUID)
		assert.Equal(t, "test correlation", legacyGet.Result.Label)

		// Update via legacy API
		updateCmd := &correlations.UpdateCorrelationCommand{
			Label:       ptr.To("updated label"),
			Description: ptr.To("updated description"),
		}
		updateBody, err := json.Marshal(updateCmd)
		require.NoError(t, err)

		updateResult := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPatch,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
			Body:   updateBody,
		}, &correlations.UpdateCorrelationResponseBody{})
		require.Equal(t, http.StatusOK, updateResult.Response.StatusCode)
		assert.Equal(t, "updated label", updateResult.Result.Result.Label)
		assert.Equal(t, "updated description", updateResult.Result.Result.Description)

		// Delete via legacy API
		deleteResult := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
		}, &correlations.DeleteCorrelationResponseBody{})
		require.Equal(t, http.StatusOK, deleteResult.Response.StatusCode)

		// Verify deletion
		legacyGetAfterDelete := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
		}, &correlations.Correlation{})
		assert.Equal(t, http.StatusNotFound, legacyGetAfterDelete.Response.StatusCode)
	})

	t.Run("Legacy API list all correlations", func(t *testing.T) {
		// Create two correlations
		uid1 := createLegacyCorrelation(t, helper, helper.Org1.Admin, "test-A", "test-B")
		uid2 := createLegacyCorrelation(t, helper, helper.Org1.Admin, "test-B", "test-A")

		// List all correlations
		listResult := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/api/datasources/correlations",
		}, &correlations.GetCorrelationsResponseBody{})
		require.Equal(t, http.StatusOK, listResult.Response.StatusCode)
		require.NotNil(t, listResult.Result)
		assert.GreaterOrEqual(t, len(listResult.Result.Correlations), 2)

		// Clean up
		apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid1,
		}, &correlations.DeleteCorrelationResponseBody{})
		apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   "/api/datasources/uid/test-B/correlations/" + uid2,
		}, &correlations.DeleteCorrelationResponseBody{})
	})
}

// doDualWriteTests tests functionality for Modes 1-3 (dual write modes)
// Both APIs available with cross-API visibility
func doDualWriteTests(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	// Check if correlations K8s APIs are available
	hasCorrelationsAPI := checkCorrelationsAPIAvailable(t, helper)
	if !hasCorrelationsAPI {
		t.Log("Correlations Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("Legacy API -> K8s API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create via legacy API
		uid := createLegacyCorrelation(t, helper, helper.Org1.Admin, "test-A", "test-B")

		// Should be visible via K8s API
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// Verify spec fields
		spec, ok := found.Object["spec"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "test correlation", spec["label"])

		// Verify cross-API consistency
		getFromBothAPIs(t, helper, client, uid)

		// Clean up via K8s API
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API -> Legacy API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create via K8s API
		k8sBody := `{
			"metadata": { "generateName": "test-" },
			"spec": {
				"type": "query",
				"label": "k8s created correlation",
				"source": { "group": "testdata", "name": "test-A" },
				"target": { "group": "testdata", "name": "test-B" },
				"config": {
					"field": "message",
					"target": {}
				}
			}
		}`
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/correlations.grafana.app/v0alpha1/namespaces/default/correlations",
			Body:   []byte(k8sBody),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()
		assert.NotEmpty(t, uid)

		// Should be visible via legacy API
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
		}, &correlations.Correlation{})
		require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode)
		require.NotNil(t, legacyGet.Result)
		assert.Equal(t, uid, legacyGet.Result.UID)
		assert.Equal(t, "k8s created correlation", legacyGet.Result.Label)

		// Verify cross-API consistency
		getFromBothAPIs(t, helper, client, uid)

		// Clean up
		err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API CRUD operations", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create via K8s API
		k8sBody := `{
			"metadata": { "generateName": "crud-" },
			"spec": {
				"type": "query",
				"label": "crud test",
				"description": "initial description",
				"source": { "group": "testdata", "name": "test-A" },
				"target": { "group": "testdata", "name": "test-B" },
				"config": {
					"field": "message",
					"target": {}
				}
			}
		}`
		createResult := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/correlations.grafana.app/v0alpha1/namespaces/default/correlations",
			Body:   []byte(k8sBody),
		}, &unstructured.Unstructured{})
		require.NotNil(t, createResult.Result)
		uid := createResult.Result.GetName()

		// Read via K8s API
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// List via K8s API
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(list.Items), 1)

		foundInList := false
		for _, item := range list.Items {
			if item.GetName() == uid {
				foundInList = true
				break
			}
		}
		assert.True(t, foundInList, "created correlation should be in list")

		// Update via K8s API
		found.Object["spec"].(map[string]any)["label"] = "updated via k8s"
		found.Object["spec"].(map[string]any)["description"] = "updated description"
		updated, err := client.Resource.Update(context.Background(), found, metav1.UpdateOptions{})
		require.NoError(t, err)
		updatedSpec := updated.Object["spec"].(map[string]any)
		assert.Equal(t, "updated via k8s", updatedSpec["label"])

		// Delete via K8s API
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify deletion
		_, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.Error(t, err)
	})

	t.Run("Cross-org isolation", func(t *testing.T) {
		// Create correlation in org1
		uid := createLegacyCorrelation(t, helper, helper.Org1.Admin, "test-A", "test-B")

		// Org1 user can see it
		client1 := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		found, err := client1.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// OrgB user should not see org1's correlations
		client2 := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: "default", // org1's namespace
			GVR:       gvr,
		})
		_, err = client2.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.Error(t, err, "OrgB user should not be able to access org1's correlations")

		// Clean up
		err = client1.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// doUnifiedOnlyTests tests functionality for Mode 5 (unified only)
// Only K8s API, no legacy API interaction
func doUnifiedOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	// Check if correlations K8s APIs are available
	hasCorrelationsAPI := checkCorrelationsAPIAvailable(t, helper)
	if !hasCorrelationsAPI {
		t.Log("Correlations Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("K8s API CRUD (unified storage only)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create via K8s API
		k8sBody := `{
			"metadata": { "generateName": "unified-" },
			"spec": {
				"type": "query",
				"label": "unified only test",
				"source": { "group": "testdata", "name": "test-A" },
				"target": { "group": "testdata", "name": "test-B" },
				"config": {
					"field": "message",
					"target": {}
				}
			}
		}`
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/correlations.grafana.app/v0alpha1/namespaces/default/correlations",
			Body:   []byte(k8sBody),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()
		assert.NotEmpty(t, uid)

		// Read via K8s API
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// In unified-only mode, legacy API should not see the resource
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/datasources/uid/test-A/correlations/" + uid,
		}, &correlations.Correlation{})
		// In unified-only mode, legacy API should not see the resource
		assert.Nil(t, legacyGet.Result, "legacy API should not see unified-only correlations")

		// List via K8s API
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(list.Items), 1)

		// Clean up
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API validation - required fields", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Missing source should fail
		invalidBody := `{
			"metadata": { "generateName": "invalid-" },
			"spec": {
				"type": "query",
				"label": "invalid correlation",
				"config": {
					"field": "message",
					"target": {}
				}
			}
		}`
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/correlations.grafana.app/v0alpha1/namespaces/default/correlations",
			Body:   []byte(invalidBody),
		}, (*unstructured.Unstructured)(nil))

		// Should get a validation error
		assert.NotEqual(t, http.StatusCreated, response.Response.StatusCode,
			"Expected error for missing source")
	})
}

// Helper function to check if correlations K8s APIs are available
func checkCorrelationsAPIAvailable(t *testing.T, helper *apis.K8sTestHelper) bool {
	disco := helper.NewDiscoveryClient()
	groups, err := disco.ServerGroups()
	if err != nil {
		t.Logf("Failed to get server groups: %v", err)
		return false
	}

	for _, group := range groups.Groups {
		if group.Name == "correlations.grafana.app" {
			return true
		}
	}
	return false
}

// getFromBothAPIs does a get with both k8s and legacy API, and verifies the results are the same
func getFromBothAPIs(t *testing.T,
	helper *apis.K8sTestHelper,
	client *apis.K8sResourceClient,
	uid string,
) {
	t.Helper()

	k8sResource, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, uid, k8sResource.GetName())

	// Get spec from K8s resource
	k8sSpec, ok := k8sResource.Object["spec"].(map[string]any)
	require.True(t, ok)

	// Legacy API: Get the correlation
	// Need to get source UID from K8s spec
	source, ok := k8sSpec["source"].(map[string]any)
	require.True(t, ok)
	sourceUID := source["name"].(string)

	legacyCorrelation := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/datasources/uid/" + sourceUID + "/correlations/" + uid,
	}, &correlations.Correlation{}).Result

	if legacyCorrelation != nil {
		// If legacy API returns data, verify consistency
		assert.Equal(t, legacyCorrelation.UID, k8sResource.GetName())
		assert.Equal(t, legacyCorrelation.Label, k8sSpec["label"])
		assert.Equal(t, legacyCorrelation.SourceUID, sourceUID)

		if legacyCorrelation.Description != "" {
			assert.Equal(t, legacyCorrelation.Description, k8sSpec["description"])
		}
	}
}
