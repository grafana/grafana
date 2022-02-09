package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetResourcesMetadata(t *testing.T) {
	tests := []struct {
		desc         string
		resource     string
		resourcesIDs map[string]bool
		permissions  []*Permission
		expected     map[string]Metadata
	}{
		{
			desc:         "Should return no permission for resources 1,2,3 given the user has no permission",
			resource:     "resources",
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected:     map[string]Metadata{},
		},
		{
			desc:     "Should return no permission for resources 1,2,3 given the user has permissions for 4 only",
			resource: "resources",
			permissions: []*Permission{
				{Action: "resources:action1", Scope: Scope("resources", "id", "4")},
				{Action: "resources:action2", Scope: Scope("resources", "id", "4")},
				{Action: "resources:action3", Scope: Scope("resources", "id", "4")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected:     map[string]Metadata{},
		},
		{
			desc:     "Should only return permissions for resources 1 and 2, given the user has no permissions for 3",
			resource: "resources",
			permissions: []*Permission{
				{Action: "resources:action1", Scope: Scope("resources", "id", "1")},
				{Action: "resources:action2", Scope: Scope("resources", "id", "2")},
				{Action: "resources:action3", Scope: Scope("resources", "id", "2")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true},
				"2": {"resources:action2": true, "resources:action3": true},
			},
		},
		{
			desc:     "Should return permissions with global scopes for resources 1,2,3",
			resource: "resources",
			permissions: []*Permission{
				{Action: "resources:action4", Scope: Scope("resources", "id", "*")},
				{Action: "resources:action5", Scope: Scope("resources", "*")},
				{Action: "resources:action6", Scope: "*"},
				{Action: "resources:action1", Scope: Scope("resources", "id", "1")},
				{Action: "resources:action2", Scope: Scope("resources", "id", "2")},
				{Action: "resources:action3", Scope: Scope("resources", "id", "2")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true, "resources:action4": true, "resources:action5": true, "resources:action6": true},
				"2": {"resources:action2": true, "resources:action3": true, "resources:action4": true, "resources:action5": true, "resources:action6": true},
				"3": {"resources:action4": true, "resources:action5": true, "resources:action6": true},
			},
		},
		{
			desc:     "Should correctly filter out irrelevant permissions for resources 1,2,3",
			resource: "resources",
			permissions: []*Permission{
				{Action: "resources:action1", Scope: Scope("resources", "id", "1")},
				{Action: "otherresources:action1", Scope: Scope("resources", "id", "1")},
				{Action: "resources:action2", Scope: Scope("otherresources", "id", "*")},
				{Action: "otherresources:action1", Scope: Scope("otherresources", "id", "*")},
			},
			resourcesIDs: map[string]bool{"1": true, "2": true, "3": true},
			expected: map[string]Metadata{
				"1": {"resources:action1": true, "otherresources:action1": true},
			},
		},
		{
			desc:     "Should correctly handle permissions with multilayer scope",
			resource: "resources:sub",
			permissions: []*Permission{
				{Action: "resources:action1", Scope: Scope("resources", "sub", "id", "1")},
				{Action: "resources:action1", Scope: Scope("resources", "sub", "id", "123")},
			},
			resourcesIDs: map[string]bool{"1": true, "123": true},
			expected: map[string]Metadata{
				"1":   {"resources:action1": true},
				"123": {"resources:action1": true},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			metadata := GetResourcesMetadata(context.Background(), tt.permissions, tt.resource, tt.resourcesIDs)
			assert.EqualValues(t, tt.expected, metadata)
		})
	}
}
