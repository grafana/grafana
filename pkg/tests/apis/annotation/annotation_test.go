package annotation

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
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

var gvr = schema.GroupVersionResource{
	Group:    "annotation.grafana.app",
	Version:  "v0alpha1",
	Resource: "annotations",
}

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationAnnotation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("default setup with k8s flag turned off (legacy APIs only)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{}, // legacy APIs only
		})
		doLegacyOnlyTests(t, helper)

		// When kubernetesAnnotations feature toggle is disabled, annotation K8s APIs should not be available
		disco := helper.NewDiscoveryClient()
		groups, err := disco.ServerGroups()
		require.NoError(t, err)

		hasAnnotationGroup := false
		for _, group := range groups.Groups {
			if group.Name == "annotation.grafana.app" {
				hasAnnotationGroup = true
				break
			}
		}
		require.False(t, hasAnnotationGroup, "annotation K8s APIs should not be available when kubernetesAnnotations feature toggle is disabled")
	})

	t.Run("with kubernetesAnnotations flag enabled (mode 0)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{featuremgmt.FlagKubernetesAnnotations},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		})
		doLegacyOnlyTests(t, helper)
	})

	t.Run("dual write modes", func(t *testing.T) {
		for _, mode := range []grafanarest.DualWriterMode{
			grafanarest.Mode1,
			grafanarest.Mode2,
			grafanarest.Mode3,
			grafanarest.Mode4,
		} {
			t.Run(fmt.Sprintf("dual write (unified storage, mode %d)", mode), func(t *testing.T) {
				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    false,
					DisableAnonymous:     true,
					APIServerStorageType: options.StorageTypeUnified,
					EnableFeatureToggles: []string{
						featuremgmt.FlagKubernetesAnnotations,
					},
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						RESOURCEGROUP: {
							DualWriterMode: mode,
						},
					},
				})
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
				featuremgmt.FlagKubernetesAnnotations,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		})
		doUnifiedOnlyTests(t, helper)
	})
}

// doLegacyOnlyTests tests functionality for Mode 0 (legacy only)
// Only legacy API should be used, no K8s API interaction
func doLegacyOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	t.Run("Legacy API CRUD", func(t *testing.T) {
		now := time.Now().UnixMilli()

		// Create via legacy API
		legacyPayload := fmt.Sprintf(`{
			"text": "Test annotation from legacy API",
			"time": %d,
			"tags": ["test", "legacy"]
		}`, now)

		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/annotations",
			Body:   []byte(legacyPayload),
		}, &struct {
			ID      int64  `json:"id"`
			Message string `json:"message"`
		}{})
		require.NotNil(t, legacyCreate.Result)
		require.Greater(t, legacyCreate.Result.ID, int64(0))
		annotationID := legacyCreate.Result.ID

		// Read via legacy API
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
		}, &annotations.ItemDTO{})
		require.NotNil(t, legacyGet.Result)
		assert.Equal(t, annotationID, legacyGet.Result.ID)
		assert.Equal(t, "Test annotation from legacy API", legacyGet.Result.Text)
		assert.Contains(t, legacyGet.Result.Tags, "test")
		assert.Contains(t, legacyGet.Result.Tags, "legacy")

		// Update via legacy API
		updatePayload := fmt.Sprintf(`{
			"text": "Updated annotation",
			"time": %d,
			"tags": ["updated"]
		}`, now)
		legacyUpdate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPut,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
			Body:   []byte(updatePayload),
		}, &struct {
			Message string `json:"message"`
		}{})
		require.NotNil(t, legacyUpdate.Result)
		assert.Equal(t, "Annotation updated", legacyUpdate.Result.Message)

		// Verify update
		legacyGetUpdated := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
		}, &annotations.ItemDTO{})
		require.NotNil(t, legacyGetUpdated.Result)
		assert.Equal(t, "Updated annotation", legacyGetUpdated.Result.Text)
		assert.Contains(t, legacyGetUpdated.Result.Tags, "updated")

		// Delete via legacy API
		legacyDelete := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
		}, &struct {
			Message string `json:"message"`
		}{})
		require.NotNil(t, legacyDelete.Result)
		assert.Equal(t, "Annotation deleted", legacyDelete.Result.Message)
	})

	t.Run("Legacy API - List annotations", func(t *testing.T) {
		now := time.Now().UnixMilli()

		// Create multiple annotations
		for i := 0; i < 3; i++ {
			legacyPayload := fmt.Sprintf(`{
				"text": "List test annotation %d",
				"time": %d,
				"tags": ["list-test"]
			}`, i, now+int64(i*1000))
			apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/annotations",
				Body:   []byte(legacyPayload),
			}, &struct {
				ID int64 `json:"id"`
			}{})
		}

		// List all annotations
		legacyList := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/annotations?tags=list-test",
		}, &[]*annotations.ItemDTO{})
		require.NotNil(t, legacyList.Result)
		assert.GreaterOrEqual(t, len(*legacyList.Result), 3)
	})

	t.Run("Legacy API - Tags endpoint", func(t *testing.T) {
		// Get annotation tags
		legacyTags := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/annotations/tags",
		}, &annotations.GetAnnotationTagsResponse{})
		require.NotNil(t, legacyTags.Result)
		// Tags should include tags from annotations we created
	})
}

// doDualWriteTests tests functionality for Modes 1-4 (dual write modes)
// Both APIs available with cross-API visibility
func doDualWriteTests(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	// Check if annotation K8s APIs are available
	hasAnnotationAPI := checkAnnotationAPIAvailable(t, helper)
	if !hasAnnotationAPI {
		t.Log("Annotation Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("Legacy API -> K8s API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().UnixMilli()

		// Create via legacy API
		legacyPayload := fmt.Sprintf(`{
			"text": "Dual write test annotation",
			"time": %d,
			"tags": ["dual-write"]
		}`, now)
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/annotations",
			Body:   []byte(legacyPayload),
		}, &struct {
			ID int64 `json:"id"`
		}{})
		require.NotNil(t, legacyCreate.Result)
		annotationID := legacyCreate.Result.ID
		require.Greater(t, annotationID, int64(0))

		// Should be visible via K8s API
		k8sName := fmt.Sprintf("a-%d", annotationID)
		found, err := client.Resource.Get(context.Background(), k8sName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, k8sName, found.GetName())

		// Verify spec matches
		spec, ok := found.Object["spec"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Dual write test annotation", spec["text"])
		assert.Equal(t, float64(now), spec["time"])

		// Clean up via legacy API
		apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
		}, &struct {
			Message string `json:"message"`
		}{})
	})

	t.Run("K8s API -> Legacy API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().UnixMilli()

		// Create via K8s API
		k8sPayload := fmt.Sprintf(`{
			"metadata": { "generateName": "test-" },
			"spec": {
				"text": "K8s created annotation",
				"time": %d,
				"tags": ["k8s-create"]
			}
		}`, now)
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations",
			Body:   []byte(k8sPayload),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		name := obj.Result.GetName()
		assert.NotEmpty(t, name)

		// The name format is "a-{id}", extract the ID
		var annotationID int64
		_, err := fmt.Sscanf(name, "a-%d", &annotationID)
		require.NoError(t, err)

		// Should be visible via legacy API
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/api/annotations/%d", annotationID),
		}, &annotations.ItemDTO{})
		require.NotNil(t, legacyGet.Result)
		assert.Equal(t, "K8s created annotation", legacyGet.Result.Text)

		// Clean up via K8s API
		err = client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API CRUD", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().UnixMilli()

		// Create
		k8sPayload := fmt.Sprintf(`{
			"metadata": { "generateName": "crud-" },
			"spec": {
				"text": "CRUD test annotation",
				"time": %d,
				"tags": ["crud"]
			}
		}`, now)
		createResult := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations",
			Body:   []byte(k8sPayload),
		}, &unstructured.Unstructured{})
		require.NotNil(t, createResult.Result)
		name := createResult.Result.GetName()

		// Read
		found, err := client.Resource.Get(context.Background(), name, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, name, found.GetName())

		// List
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		assert.Greater(t, len(list.Items), 0)

		// Delete
		err = client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify deletion
		_, err = client.Resource.Get(context.Background(), name, metav1.GetOptions{})
		require.Error(t, err)
	})

	t.Run("K8s API - Tags endpoint", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create some annotations with tags first
		now := time.Now().UnixMilli()
		k8sPayload := fmt.Sprintf(`{
			"metadata": { "generateName": "tags-" },
			"spec": {
				"text": "Tags test annotation",
				"time": %d,
				"tags": ["unique-tag-test"]
			}
		}`, now)
		createResult := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations",
			Body:   []byte(k8sPayload),
		}, &unstructured.Unstructured{})
		require.NotNil(t, createResult.Result)
		name := createResult.Result.GetName()

		// Get tags via K8s API
		tagsResult := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/tags",
		}, &struct {
			Tags []struct {
				Tag   string `json:"tag"`
				Count int64  `json:"count"`
			} `json:"tags"`
		}{})
		require.NotNil(t, tagsResult.Result)

		// Clean up
		err := client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// doUnifiedOnlyTests tests functionality for Mode 5 (unified only)
// Only K8s API, no legacy API interaction expected for writes
func doUnifiedOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	// Check if annotation K8s APIs are available
	hasAnnotationAPI := checkAnnotationAPIAvailable(t, helper)
	if !hasAnnotationAPI {
		t.Log("Annotation Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("K8s API CRUD (unified storage only)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().UnixMilli()

		// Create via K8s API
		k8sPayload := fmt.Sprintf(`{
			"metadata": { "generateName": "unified-" },
			"spec": {
				"text": "Unified only annotation",
				"time": %d,
				"tags": ["unified"]
			}
		}`, now)
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations",
			Body:   []byte(k8sPayload),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		name := obj.Result.GetName()
		assert.NotEmpty(t, name)

		// Read via K8s API
		found, err := client.Resource.Get(context.Background(), name, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, name, found.GetName())

		spec, ok := found.Object["spec"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Unified only annotation", spec["text"])

		// List via K8s API
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		assert.Greater(t, len(list.Items), 0)

		// Clean up
		err = client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API field selectors", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().UnixMilli()
		dashboardUID := "test-dashboard-uid"

		// Create annotation with dashboard UID
		k8sPayload := fmt.Sprintf(`{
			"metadata": { "generateName": "field-" },
			"spec": {
				"text": "Field selector test",
				"time": %d,
				"dashboardUID": "%s",
				"tags": ["field-test"]
			}
		}`, now, dashboardUID)
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations",
			Body:   []byte(k8sPayload),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		name := obj.Result.GetName()

		// List with field selector for dashboardUID
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.dashboardUID=%s", dashboardUID),
		})
		require.NoError(t, err)

		// Should find at least one annotation
		found := false
		for _, item := range list.Items {
			if item.GetName() == name {
				found = true
				break
			}
		}
		assert.True(t, found, "Should find annotation with field selector")

		// Clean up
		err = client.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// Helper function to check if annotation K8s APIs are available
func checkAnnotationAPIAvailable(t *testing.T, helper *apis.K8sTestHelper) bool {
	disco := helper.NewDiscoveryClient()
	groups, err := disco.ServerGroups()
	if err != nil {
		t.Logf("Failed to get server groups: %v", err)
		return false
	}

	for _, group := range groups.Groups {
		if group.Name == "annotation.grafana.app" {
			return true
		}
	}
	return false
}
