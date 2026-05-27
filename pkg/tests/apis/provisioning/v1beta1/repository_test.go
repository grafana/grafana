// SPDX-License-Identifier: AGPL-3.0-only

package v1beta1

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

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
					"enabled":         false,
					"target":          "folder",
					"intervalSeconds": 60,
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
