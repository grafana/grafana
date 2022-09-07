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
	wildcards := WildcardsFromPrefix(prefix)

	// index of the prefix in the scope
	prefixIndex := len(prefix)

	// Loop through permissions once
	result := map[string]Metadata{}

	for action, scopes := range permissions {
		for _, scope := range scopes {
			if wildcards.Contains(scope) {
				for id := range resourceIDs {
					result = addActionToMetadata(result, action, id)
				}
				break
			}
			if len(scope) > prefixIndex && strings.HasPrefix(scope, prefix) && resourceIDs[scope[prefixIndex:]] {
				// Add action to a specific resource
				result = addActionToMetadata(result, action, scope[prefixIndex:])
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
