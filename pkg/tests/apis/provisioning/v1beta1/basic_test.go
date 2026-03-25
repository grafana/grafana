// SPDX-License-Identifier: AGPL-3.0-only

package v1beta1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// TestIntegrationV1Beta1ConnectionCRUD tests basic CRUD operations on the v1beta1 Connection resource
func TestIntegrationV1Beta1ConnectionCRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("list connections via v1beta1", func(t *testing.T) {
		// Note: Connection creation requires secure values (like appID/installationID for github)
		// Full connection CRUD tests are in connection_test.go
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
