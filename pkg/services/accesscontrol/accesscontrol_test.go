package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetResourcesMetadata(t *testing.T) {
	tests := []struct {
		desc         string
		prefix       string
		resourcesIDs map[string]bool
		permissions  map[string][]string
		expected     map[string]Metadata
	}{
		{
			desc:         "Should return no permission for resources 1,2,3 given the user has no permission",
			prefix:       "resources:id:",
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected:     map[string]Metadata{},
		},
		{
			desc:   "Should return no permission for resources 1,2,3 given the user has permissions for 4 only",
			prefix: "resources:id:",
			permissions: map[string][]string{
				"resources:action1": {Scope("resources", "id", "4")},
				"resources:action2": {Scope("resources", "id", "4")},
				"resources:action3": {Scope("resources", "id", "4")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected:     map[string]Metadata{},
		},
		{
			desc:   "Should only return permissions for resources 1 and 2, given the user has no permissions for 3",
			prefix: "resources:id:",
			permissions: map[string][]string{
				"resources:action1": {Scope("resources", "id", "1")},
				"resources:action2": {Scope("resources", "id", "2")},
				"resources:action3": {Scope("resources", "id", "2")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true},
				"2": {"resources:action2": true, "resources:action3": true},
			},
		},
		{
			desc:   "Should return permissions with global scopes for resources 1,2,3",
			prefix: "resources:id:",
			permissions: map[string][]string{
				"resources:action1": {Scope("resources", "id", "1")},
				"resources:action2": {Scope("resources", "id", "2")},
				"resources:action3": {Scope("resources", "id", "2")},
				"resources:action4": {Scope("resources", "id", "*")},
				"resources:action5": {Scope("resources", "*")},
				"resources:action6": {"*"},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true, "resources:action4": true, "resources:action5": true, "resources:action6": true},
				"2": {"resources:action2": true, "resources:action3": true, "resources:action4": true, "resources:action5": true, "resources:action6": true},
				"3": {"resources:action4": true, "resources:action5": true, "resources:action6": true},
			},
		},
		{
			desc:   "Should correctly filter out irrelevant permissions for resources 1,2,3",
			prefix: "resources:id:",
			permissions: map[string][]string{
				"resources:action1":      {Scope("resources", "id", "1")},
				"resources:action2":      {Scope("otherresources", "id", "*")},
				"otherresources:action1": {Scope("resources", "id", "1"), Scope("otherresources", "id", "*")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true, "otherresources:action1": true},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			metadata := GetResourcesMetadata(context.Background(), tt.permissions, tt.prefix, tt.resourcesIDs)
			assert.EqualValues(t, tt.expected, metadata)
		})
	}
}
