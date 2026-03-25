// SPDX-License-Identifier: AGPL-3.0-only

package v1beta1

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// TestIntegrationV1Beta1APIAvailable verifies that the v1beta1 API group/version is available
func TestIntegrationV1Beta1APIAvailable(t *testing.T) {
	helper := sharedHelper(t)

	// Use the REST client to get API groups
	result := helper.AdminREST.Get().AbsPath("/apis").Do(context.Background())
	require.NoError(t, result.Error(), "should be able to get API groups")

	var apiGroupList metav1.APIGroupList
	err := result.Into(&apiGroupList)
	require.NoError(t, err)

	// Find the provisioning API group
	var provisioningGroup *metav1.APIGroup
	for i := range apiGroupList.Groups {
		if apiGroupList.Groups[i].Name == "provisioning.grafana.app" {
			provisioningGroup = &apiGroupList.Groups[i]
			break
		}
	}

	require.NotNil(t, provisioningGroup, "provisioning API group should exist")

	// Verify v1beta1 is in the available versions
	foundV1Beta1 := false
	for _, version := range provisioningGroup.Versions {
		if version.Version == "v1beta1" {
			foundV1Beta1 = true
			break
		}
	}

	require.True(t, foundV1Beta1, "v1beta1 should be available in the provisioning API group")
	t.Logf("✓ v1beta1 API is available")
}

// TestIntegrationV1Beta1OpenAPISchema verifies that the v1beta1 OpenAPI schema is properly generated
func TestIntegrationV1Beta1OpenAPISchema(t *testing.T) {
	helper := sharedHelper(t)

	// Get the OpenAPI v3 spec for v1beta1
	result := helper.AdminREST.Get().AbsPath("/openapi/v3/apis/provisioning.grafana.app/v1beta1").Do(context.Background())
	require.NoError(t, result.Error(), "should be able to get v1beta1 OpenAPI schema")

	// Get the raw bytes
	body, err := result.Raw()
	require.NoError(t, err, "should be able to get raw response")

	// Parse the OpenAPI document
	var openAPIDoc map[string]interface{}
	err = json.Unmarshal(body, &openAPIDoc)
	require.NoError(t, err, "should be able to parse OpenAPI document")

	// Verify components/schemas exist
	components, ok := openAPIDoc["components"].(map[string]interface{})
	require.True(t, ok, "components should exist in OpenAPI doc")

	schemas, ok := components["schemas"].(map[string]interface{})
	require.True(t, ok, "schemas should exist in components")

	// Verify that v1beta1 schemas exist (and no v0alpha1 schemas)
	foundV1Beta1Schema := false
	foundV0Alpha1Schema := false

	for schemaName := range schemas {
		if strings.Contains(schemaName, ".provisioning.v1beta1.") {
			foundV1Beta1Schema = true
			t.Logf("  Found v1beta1 schema: %s", schemaName)
		}
		if strings.Contains(schemaName, ".provisioning.v0alpha1.") {
			foundV0Alpha1Schema = true
			t.Errorf("  ERROR: Found v0alpha1 schema in v1beta1 OpenAPI: %s", schemaName)
		}
	}

	require.True(t, foundV1Beta1Schema, "should have v1beta1 schemas in OpenAPI doc")
	require.False(t, foundV0Alpha1Schema, "should not have v0alpha1 schemas in v1beta1 OpenAPI doc")
	t.Logf("✓ OpenAPI schema has only v1beta1 types (no v0alpha1)")
}

// TestIntegrationV1Beta1RepositoryCRUD tests basic CRUD operations on the v1beta1 Repository resource
func TestIntegrationV1Beta1RepositoryCRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	repoName := "test-v1beta1-repo"

	t.Run("create repository via v1beta1", func(t *testing.T) {
		repo := map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v1beta1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      repoName,
				"namespace": "default",
				"finalizers": []string{
					"remove-orphan-resources",
					"cleanup",
				},
			},
			"spec": map[string]interface{}{
				"title": "Test v1beta1 Repository",
				"type":  "local",
				"local": map[string]interface{}{
					"path": helper.ProvisioningPath,
				},
				"workflows": []string{"write"},
				"sync": map[string]interface{}{
					"enabled":         true,
					"target":          "folder",
					"intervalSeconds": 10,
				},
			},
		}

		repoBytes, err := json.Marshal(repo)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories").
			Body(repoBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to create repository via v1beta1")

		var created unstructured.Unstructured
		err = result.Into(&created)
		require.NoError(t, err)

		// Verify apiVersion is v1beta1
		assert.Equal(t, "provisioning.grafana.app/v1beta1", created.GetAPIVersion(), "created resource should have v1beta1 apiVersion")
		t.Logf("✓ Created repository via v1beta1")
	})

	t.Run("get repository via v1beta1", func(t *testing.T) {
		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/" + repoName).
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to get repository via v1beta1")

		var fetched unstructured.Unstructured
		err := result.Into(&fetched)
		require.NoError(t, err)

		// Verify apiVersion is v1beta1
		assert.Equal(t, "provisioning.grafana.app/v1beta1", fetched.GetAPIVersion(), "fetched resource should have v1beta1 apiVersion")

		// Verify basic fields
		title, _, _ := unstructured.NestedString(fetched.Object, "spec", "title")
		assert.Equal(t, "Test v1beta1 Repository", title)
		t.Logf("✓ Retrieved repository via v1beta1")
	})

	t.Run("list repositories via v1beta1", func(t *testing.T) {
		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to list repositories via v1beta1")

		var list unstructured.UnstructuredList
		err := result.Into(&list)
		require.NoError(t, err)

		// Should have at least our test repository
		assert.GreaterOrEqual(t, len(list.Items), 1, "should have at least one repository")

		// Verify list apiVersion is v1beta1
		assert.Equal(t, "provisioning.grafana.app/v1beta1", list.GetAPIVersion(), "list should have v1beta1 apiVersion")
		t.Logf("✓ Listed %d repositories via v1beta1", len(list.Items))
	})

	t.Run("delete repository via v1beta1", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/" + repoName).
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to delete repository via v1beta1")

		// Wait for deletion
		require.Eventually(t, func() bool {
			result := helper.AdminREST.Get().
				AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/" + repoName).
				Do(ctx)
			return result.Error() != nil
		}, 10*time.Second, 100*time.Millisecond, "repository should be deleted")

		t.Logf("✓ Deleted repository via v1beta1")
	})
}

// TestIntegrationV1Beta1ConnectionCRUD tests basic CRUD operations on the v1beta1 Connection resource
func TestIntegrationV1Beta1ConnectionCRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("list connections via v1beta1", func(t *testing.T) {
		// Note: Connection creation requires secure values (like appID/installationID for github)
		// Full connection CRUD tests are in the main provisioning test suite
		// Here we just verify the API endpoint responds correctly for v1beta1

		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/connections").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to list connections via v1beta1")

		var list unstructured.UnstructuredList
		err := result.Into(&list)
		require.NoError(t, err)

		// Verify list apiVersion is v1beta1
		assert.Equal(t, "provisioning.grafana.app/v1beta1", list.GetAPIVersion(), "list should have v1beta1 apiVersion")
		t.Logf("✓ Connection API endpoint works for v1beta1")
	})
}
