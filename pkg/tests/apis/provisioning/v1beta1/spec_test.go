// SPDX-License-Identifier: AGPL-3.0-only

package v1beta1

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
