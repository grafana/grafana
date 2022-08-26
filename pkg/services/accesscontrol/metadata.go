package accesscontrol

import (
	"context"
	"strings"
)

// Metadata contains user accesses for a given resource
// Ex: map[string]bool{"create":true, "delete": true}
type Metadata map[string]bool

// GetResourcesMetadata returns a map of accesscontrol metadata, listing for each resource, users available actions
func GetResourcesMetadata(ctx context.Context, permissions map[string][]string, prefix string, resourceIDs map[string]bool) map[string]Metadata {
	rootPrefix, attributePrefix, ok := extractPrefixes(prefix)
	if !ok {
		return map[string]Metadata{}
	}

	allScope := GetResourceAllScope(strings.TrimSuffix(rootPrefix, ":"))
	allAttributeScope := Scope(strings.TrimSuffix(attributePrefix, ":"), "*")

	// index of the attribute in the scope
	attributeIndex := len(attributePrefix)

	// Loop through permissions once
	result := map[string]Metadata{}

	for action, scopes := range permissions {
		for _, scope := range scopes {
			if scope == "*" || scope == allScope || scope == allAttributeScope {
				// Add global action to all resources
				for id := range resourceIDs {
					result = addActionToMetadata(result, action, id)
				}
			} else {
				if len(scope) > attributeIndex && strings.HasPrefix(scope, attributePrefix) && resourceIDs[scope[attributeIndex:]] {
					// Add action to a specific resource
					result = addActionToMetadata(result, action, scope[attributeIndex:])
				}
			}
		}
	}

	return result
}

func addActionToMetadata(allMetadata map[string]Metadata, action, id string) map[string]Metadata {
	metadata, initialized := allMetadata[id]
	if !initialized {
		metadata = Metadata{action: true}
	} else {
		metadata[action] = true
	}
	allMetadata[id] = metadata
	return allMetadata
}

// MergeMeta will merge actions matching prefix of second metadata into first
func MergeMeta(prefix string, first Metadata, second Metadata) Metadata {
	if first == nil {
		first = Metadata{}
	}

	for key := range second {
		if strings.HasPrefix(key, prefix) {
			first[key] = true
		}
	}
	return first
}

func extractPrefixes(prefix string) (string, string, bool) {
	parts := strings.Split(strings.TrimSuffix(prefix, ":"), ":")
	if len(parts) != 2 {
		return "", "", false
	}
	rootPrefix := parts[0] + ":"
	attributePrefix := rootPrefix + parts[1] + ":"
	return rootPrefix, attributePrefix, true
}
