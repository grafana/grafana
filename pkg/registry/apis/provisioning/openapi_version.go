// SPDX-License-Identifier: AGPL-3.0-only

package provisioning

import (
	"strings"

	"k8s.io/kube-openapi/pkg/common"
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

	return schema
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
