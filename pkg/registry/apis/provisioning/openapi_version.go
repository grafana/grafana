// SPDX-License-Identifier: AGPL-3.0-only

package provisioning

import (
	"fmt"
	"strings"

	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// ReplaceOpenAPIVersion replaces all occurrences of oldVersion with newVersion in OpenAPI definitions.
// It updates:
// - Definition keys (map keys)
// - Schema references (Ref fields)
// - Dependencies
// - Nested schemas (Properties, Items, AdditionalProperties, etc.)
//
// This is useful for bumping API versions when the types are structurally identical.
//
// Parameters:
//   - defs: The OpenAPI definitions to transform
//   - group: The API group name (e.g., "provisioning")
//   - oldVersion: The old API version (e.g., "v0alpha1")
//   - newVersion: The new API version (e.g., "v1beta1")
func ReplaceOpenAPIVersion(defs map[string]common.OpenAPIDefinition, group, oldVersion, newVersion string) map[string]common.OpenAPIDefinition {
	// Build the full version strings to replace
	oldVersionStr := "." + group + "." + oldVersion + "."
	newVersionStr := "." + group + "." + newVersion + "."

	result := make(map[string]common.OpenAPIDefinition, len(defs))

	for k, v := range defs {
		// Replace in the key
		newKey := strings.ReplaceAll(k, oldVersionStr, newVersionStr)

		// Skip old version keys for this group - only include the new version
		if strings.Contains(k, oldVersionStr) {
			// Don't add the old key to result
			// Only add the transformed version
			newDef := v
			newDef.Schema = replaceSchemaVersion(v.Schema, oldVersionStr, newVersionStr)
			newDef.Dependencies = replaceInStringSlice(v.Dependencies, oldVersionStr, newVersionStr)
			result[newKey] = newDef
		} else {
			// Keep keys that don't match (k8s types, etc.)
			result[k] = v
		}
	}

	return result
}

// replaceSchemaVersion recursively updates all version references in a schema
func replaceSchemaVersion(schema spec.Schema, oldVersion, newVersion string) spec.Schema {
	// Update Ref if present
	if schema.Ref.String() != "" {
		refStr := schema.Ref.String()
		newRefStr := strings.ReplaceAll(refStr, oldVersion, newVersion)
		if newRefStr != refStr {
			schema.Ref = spec.MustCreateRef(newRefStr)
		}
	}

	// Update Properties
	if len(schema.Properties) > 0 {
		newProps := make(map[string]spec.Schema, len(schema.Properties))
		for k, v := range schema.Properties {
			newProps[k] = replaceSchemaVersion(v, oldVersion, newVersion)
		}
		schema.Properties = newProps
	}

	// Update PatternProperties
	if len(schema.PatternProperties) > 0 {
		newPatternProps := make(map[string]spec.Schema, len(schema.PatternProperties))
		for k, v := range schema.PatternProperties {
			newPatternProps[k] = replaceSchemaVersion(v, oldVersion, newVersion)
		}
		schema.PatternProperties = newPatternProps
	}

	// Update Items
	if schema.Items != nil {
		if schema.Items.Schema != nil {
			updatedSchema := replaceSchemaVersion(*schema.Items.Schema, oldVersion, newVersion)
			schema.Items.Schema = &updatedSchema
		}
		if len(schema.Items.Schemas) > 0 {
			newSchemas := make([]spec.Schema, len(schema.Items.Schemas))
			for i, s := range schema.Items.Schemas {
				newSchemas[i] = replaceSchemaVersion(s, oldVersion, newVersion)
			}
			schema.Items.Schemas = newSchemas
		}
	}

	// Update AdditionalItems
	if schema.AdditionalItems != nil && schema.AdditionalItems.Schema != nil {
		updatedSchema := replaceSchemaVersion(*schema.AdditionalItems.Schema, oldVersion, newVersion)
		schema.AdditionalItems.Schema = &updatedSchema
	}

	// Update AdditionalProperties
	if schema.AdditionalProperties != nil && schema.AdditionalProperties.Schema != nil {
		updatedSchema := replaceSchemaVersion(*schema.AdditionalProperties.Schema, oldVersion, newVersion)
		schema.AdditionalProperties.Schema = &updatedSchema
	}

	// Update AllOf, AnyOf, OneOf
	if len(schema.AllOf) > 0 {
		newAllOf := make([]spec.Schema, len(schema.AllOf))
		for i, s := range schema.AllOf {
			newAllOf[i] = replaceSchemaVersion(s, oldVersion, newVersion)
		}
		schema.AllOf = newAllOf
	}

	if len(schema.AnyOf) > 0 {
		newAnyOf := make([]spec.Schema, len(schema.AnyOf))
		for i, s := range schema.AnyOf {
			newAnyOf[i] = replaceSchemaVersion(s, oldVersion, newVersion)
		}
		schema.AnyOf = newAnyOf
	}

	if len(schema.OneOf) > 0 {
		newOneOf := make([]spec.Schema, len(schema.OneOf))
		for i, s := range schema.OneOf {
			newOneOf[i] = replaceSchemaVersion(s, oldVersion, newVersion)
		}
		schema.OneOf = newOneOf
	}

	// Update Not
	if schema.Not != nil {
		updatedSchema := replaceSchemaVersion(*schema.Not, oldVersion, newVersion)
		schema.Not = &updatedSchema
	}

	// Update Definitions (for OpenAPI 2.0 compatibility)
	if len(schema.Definitions) > 0 {
		newDefs := make(spec.Definitions, len(schema.Definitions))
		for k, v := range schema.Definitions {
			newDefs[k] = replaceSchemaVersion(v, oldVersion, newVersion)
		}
		schema.Definitions = newDefs
	}

	// Update x-kubernetes-group-version-kind extension
	if schema.Extensions != nil {
		if gvkExt, exists := schema.Extensions["x-kubernetes-group-version-kind"]; exists {
			// Extract just the version part (e.g., "v0alpha1" from ".provisioning.v0alpha1.")
			oldVer := extractVersion(oldVersion)
			newVer := extractVersion(newVersion)
			schema.Extensions["x-kubernetes-group-version-kind"] = replaceGVKExtension(gvkExt, oldVer, newVer)
		}
	}

	return schema
}

// extractVersion extracts the version string from a full version pattern
// e.g., ".provisioning.v0alpha1." -> "v0alpha1"
func extractVersion(versionPattern string) string {
	// Remove leading and trailing dots
	versionPattern = strings.Trim(versionPattern, ".")
	// Split by dots and get the last part (the version)
	parts := strings.Split(versionPattern, ".")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return versionPattern
}

// replaceInStringSlice replaces all occurrences of oldVersion with newVersion in a string slice
func replaceInStringSlice(slice []string, oldVersion, newVersion string) []string {
	if len(slice) == 0 {
		return slice
	}

	result := make([]string, len(slice))
	for i, s := range slice {
		result[i] = strings.ReplaceAll(s, oldVersion, newVersion)
	}
	return result
}

// replaceGVKExtension replaces the version in x-kubernetes-group-version-kind extension
// and ensures it's always in array format
func replaceGVKExtension(gvkExt interface{}, oldVersion, newVersion string) interface{} {
	switch gvk := gvkExt.(type) {
	case map[string]interface{}:
		// Single GVK object - replace version and wrap in array
		if version, ok := gvk["version"].(string); ok && version == oldVersion {
			newGVK := map[string]interface{}{
				"group":   gvk["group"],
				"kind":    gvk["kind"],
				"version": newVersion,
			}
			return []interface{}{newGVK}
		}
		// Version doesn't match, keep as array
		return []interface{}{gvk}
	case []map[string]interface{}:
		// Typed array - replace version in each item
		result := make([]interface{}, 0, len(gvk))
		for _, item := range gvk {
			if version, ok := item["version"].(string); ok {
				newItem := map[string]interface{}{
					"group": item["group"],
					"kind":  item["kind"],
				}
				if version == oldVersion {
					newItem["version"] = newVersion
				} else {
					newItem["version"] = version
				}
				result = append(result, newItem)
			}
		}
		return result
	case []interface{}:
		// Interface array - process each item
		result := make([]interface{}, 0, len(gvk))
		for _, item := range gvk {
			if gvkMap, ok := item.(map[string]interface{}); ok {
				if version, ok := gvkMap["version"].(string); ok {
					newItem := map[string]interface{}{
						"group": gvkMap["group"],
						"kind":  gvkMap["kind"],
					}
					if version == oldVersion {
						newItem["version"] = newVersion
					} else {
						newItem["version"] = version
					}
					result = append(result, newItem)
				}
			}
		}
		return result
	}
	// Unknown type, return as-is
	return gvkExt
}

// ReplaceOpenAPISpecVersion updates all version references in an OpenAPI v3 spec and removes old version schemas.
// This updates:
// - Schema definition keys in Components.Schemas
// - $ref references in all component schemas
// - $ref references in all API path operations (GET/POST/PUT/PATCH/DELETE)
//
// After updating all references, it deletes the old version schema definitions to prevent duplicates.
//
// Parameters:
//   - oas: The OpenAPI v3 spec to transform
//   - group: The API group name (e.g., "provisioning")
//   - oldVersion: The old API version (e.g., "v0alpha1")
//   - newVersion: The new API version (e.g., "v1beta1")
func ReplaceOpenAPISpecVersion(oas *spec3.OpenAPI, group, oldVersion, newVersion string) {
	if oas == nil {
		return
	}

	// Build the full version strings to replace
	oldVersionStr := "." + group + "." + oldVersion + "."
	newVersionStr := "." + group + "." + newVersion + "."

	// Update all $ref references in component schemas
	if oas.Components != nil && oas.Components.Schemas != nil {
		for k, v := range oas.Components.Schemas {
			if v != nil && !strings.Contains(k, oldVersionStr) {
				updated := replaceSchemaVersion(*v, oldVersionStr, newVersionStr)
				oas.Components.Schemas[k] = &updated
			}
		}
	}

	// Update all $ref references in paths (API endpoint definitions)
	if oas.Paths != nil && oas.Paths.Paths != nil {
		for _, pathItem := range oas.Paths.Paths {
			if pathItem.Get != nil {
				updateOperationRefs(pathItem.Get, oldVersionStr, newVersionStr)
			}
			if pathItem.Post != nil {
				updateOperationRefs(pathItem.Post, oldVersionStr, newVersionStr)
			}
			if pathItem.Put != nil {
				updateOperationRefs(pathItem.Put, oldVersionStr, newVersionStr)
			}
			if pathItem.Patch != nil {
				updateOperationRefs(pathItem.Patch, oldVersionStr, newVersionStr)
			}
			if pathItem.Delete != nil {
				updateOperationRefs(pathItem.Delete, oldVersionStr, newVersionStr)
			}
		}
	}

	// Delete old version schema definitions after updating all references
	if oas.Components != nil && oas.Components.Schemas != nil {
		for k := range oas.Components.Schemas {
			if strings.Contains(k, oldVersionStr) {
				delete(oas.Components.Schemas, k)
			}
		}
	}

	// Replace old version with new version in x-kubernetes-group-version-kind arrays
	replaceGVKVersion(oas, oldVersion, newVersion)
}

// replaceGVKVersion replaces the old version with the new version in x-kubernetes-group-version-kind arrays
func replaceGVKVersion(oas *spec3.OpenAPI, oldVersion, newVersion string) {
	if oas.Components == nil || oas.Components.Schemas == nil {
		return
	}

	for _, schema := range oas.Components.Schemas {
		if schema == nil || schema.Extensions == nil {
			continue
		}

		gvkExt, exists := schema.Extensions["x-kubernetes-group-version-kind"]
		if !exists {
			continue
		}

		// Handle different GVK types
		switch gvk := gvkExt.(type) {
		case map[string]interface{}:
			// Single GVK object - replace version and keep as array
			if version, ok := gvk["version"].(string); ok && version == oldVersion {
				// Create new map to avoid modifying original
				newGVK := map[string]interface{}{
					"group":   gvk["group"],
					"kind":    gvk["kind"],
					"version": newVersion,
				}
				// Use []interface{} to match k8s OpenAPI expectations
				schema.Extensions["x-kubernetes-group-version-kind"] = []interface{}{newGVK}
			}
		case []map[string]interface{}:
			// Typed array - replace version in each item (deduplicate if needed)
			seen := make(map[string]bool)
			result := []interface{}{}
			for _, item := range gvk {
				if version, ok := item["version"].(string); ok {
					newItem := map[string]interface{}{
						"group": item["group"],
						"kind":  item["kind"],
					}
					if version == oldVersion {
						newItem["version"] = newVersion
					} else {
						newItem["version"] = version
					}
					// Deduplicate based on group+kind+version
					key := fmt.Sprintf("%v-%v-%v", newItem["group"], newItem["kind"], newItem["version"])
					if !seen[key] {
						seen[key] = true
						result = append(result, newItem)
					}
				}
			}
			if len(result) > 0 {
				schema.Extensions["x-kubernetes-group-version-kind"] = result
			}
		case []interface{}:
			// Interface array - convert and process
			seen := make(map[string]bool)
			result := []interface{}{}
			for _, item := range gvk {
				if gvkMap, ok := item.(map[string]interface{}); ok {
					if version, ok := gvkMap["version"].(string); ok {
						newItem := map[string]interface{}{
							"group": gvkMap["group"],
							"kind":  gvkMap["kind"],
						}
						if version == oldVersion {
							newItem["version"] = newVersion
						} else {
							newItem["version"] = version
						}
						// Deduplicate based on group+kind+version
						key := fmt.Sprintf("%v-%v-%v", newItem["group"], newItem["kind"], newItem["version"])
						if !seen[key] {
							seen[key] = true
							result = append(result, newItem)
						}
					}
				}
			}
			if len(result) > 0 {
				schema.Extensions["x-kubernetes-group-version-kind"] = result
			}
		}
	}
}

// ensureGVKForVersion ensures that all top-level resource schemas have x-kubernetes-group-version-kind
// extensions with the correct version. This is needed for multi-version APIs where types are shared
// between versions but the OpenAPI definitions need version-specific GVK metadata.
func ensureGVKForVersion(oas *spec3.OpenAPI, group, version string) {
	if oas == nil || oas.Components == nil || oas.Components.Schemas == nil {
		return
	}

	groupVersion := fmt.Sprintf(".%s.", version)

	for schemaName, schema := range oas.Components.Schemas {
		if schema == nil {
			continue
		}

		// Only process schemas for this version
		if !strings.Contains(schemaName, groupVersion) {
			continue
		}

		// Check if this is a top-level resource (has apiVersion and kind fields)
		if !isTopLevelResource(schema) {
			continue
		}

		// Extract the kind from the schema name (last component)
		kind := extractKindFromSchemaName(schemaName)
		if kind == "" {
			continue
		}

		// Add or update the GVK extension
		if schema.Extensions == nil {
			schema.Extensions = make(spec.Extensions)
		}

		schema.Extensions["x-kubernetes-group-version-kind"] = []interface{}{
			map[string]interface{}{
				"group":   group,
				"kind":    kind,
				"version": version,
			},
		}
	}
}

// isTopLevelResource checks if a schema represents a top-level Kubernetes resource
// by checking for apiVersion and kind fields
func isTopLevelResource(schema *spec.Schema) bool {
	if schema.Properties == nil {
		return false
	}

	hasAPIVersion := false
	hasKind := false

	for propName := range schema.Properties {
		if propName == "apiVersion" {
			hasAPIVersion = true
		}
		if propName == "kind" {
			hasKind = true
		}
	}

	return hasAPIVersion && hasKind
}

// extractKindFromSchemaName extracts the Kind from a schema name
// e.g., "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.Connection" -> "Connection"
func extractKindFromSchemaName(schemaName string) string {
	parts := strings.Split(schemaName, ".")
	if len(parts) > 0 {
		lastPart := parts[len(parts)-1]
		// Skip List types - they're not top-level resources
		if strings.HasSuffix(lastPart, "List") {
			return ""
		}
		return lastPart
	}
	return ""
}

// updateOperationRefs updates all $ref references in an operation (request/response schemas)
func updateOperationRefs(op *spec3.Operation, oldVersion, newVersion string) {
	if op == nil {
		return
	}

	// Update request body refs
	if op.RequestBody != nil && op.RequestBody.Content != nil {
		for _, mediaType := range op.RequestBody.Content {
			if mediaType.Schema != nil {
				updated := replaceSchemaVersion(*mediaType.Schema, oldVersion, newVersion)
				mediaType.Schema = &updated
			}
		}
	}

	// Update response refs
	if op.Responses != nil && op.Responses.StatusCodeResponses != nil {
		for _, response := range op.Responses.StatusCodeResponses {
			if response.Content != nil {
				for _, mediaType := range response.Content {
					if mediaType.Schema != nil {
						updated := replaceSchemaVersion(*mediaType.Schema, oldVersion, newVersion)
						mediaType.Schema = &updated
					}
				}
			}
		}
	}
}
