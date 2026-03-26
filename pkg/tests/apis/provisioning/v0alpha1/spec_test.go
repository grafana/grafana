// SPDX-License-Identifier: AGPL-3.0-only

package v0alpha1

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TestIntegrationV0Alpha1APIAvailable verifies that the v0alpha1 API group/version is available
func TestIntegrationV0Alpha1APIAvailable(t *testing.T) {
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

	// Verify v0alpha1 is in the available versions
	foundV0Alpha1 := false
	for _, version := range provisioningGroup.Versions {
		if version.Version == "v0alpha1" {
			foundV0Alpha1 = true
			break
		}
	}

	require.True(t, foundV0Alpha1, "v0alpha1 should be available in the provisioning API group")
	t.Logf("✓ v0alpha1 API is available")
}

// TestIntegrationV0Alpha1OpenAPISchema verifies that the v0alpha1 OpenAPI schema is properly generated
func TestIntegrationV0Alpha1OpenAPISchema(t *testing.T) {
	helper := sharedHelper(t)

	// Get the OpenAPI v3 spec for v0alpha1
	result := helper.AdminREST.Get().AbsPath("/openapi/v3/apis/provisioning.grafana.app/v0alpha1").Do(context.Background())
	require.NoError(t, result.Error(), "should be able to get v0alpha1 OpenAPI schema")

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

	// Verify that v0alpha1 schemas exist (and no v0alpha1 schemas)
	foundV0Alpha1Schema := false
	foundV0Alpha1Schema := false

	for schemaName := range schemas {
		if strings.Contains(schemaName, ".provisioning.v0alpha1.") {
			foundV0Alpha1Schema = true
			t.Logf("  Found v0alpha1 schema: %s", schemaName)
		}
		if strings.Contains(schemaName, ".provisioning.v0alpha1.") {
			foundV0Alpha1Schema = true
			t.Errorf("  ERROR: Found v0alpha1 schema in v0alpha1 OpenAPI: %s", schemaName)
		}
	}

	require.True(t, foundV0Alpha1Schema, "should have v0alpha1 schemas in OpenAPI doc")
	require.False(t, foundV0Alpha1Schema, "should not have v0alpha1 schemas in v0alpha1 OpenAPI doc")
	t.Logf("✓ OpenAPI schema has only v0alpha1 types (no v0alpha1)")
}
