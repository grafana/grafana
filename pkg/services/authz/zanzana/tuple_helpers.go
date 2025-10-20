package zanzana

import (
	"github.com/grafana/grafana/pkg/infra/log"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// TupleStringWithoutCondition returns the string representation of a tuple without its condition.
// This is useful for deduplicating tuples that have the same user, relation, and object
// but different conditions that need to be merged.
func TupleStringWithoutCondition(tuple *openfgav1.TupleKey) string {
	c := tuple.Condition
	tuple.Condition = nil
	s := tuple.String()
	tuple.Condition = c
	return s
}

// RolePermission represents a permission that can be converted to a Zanzana tuple.
type RolePermission struct {
	Action     string
	Kind       string
	Identifier string
}

// ConvertRolePermissionsToTuples converts role permissions to Zanzana tuples with proper merging.
// It handles:
// - Translation of RBAC action/kind/identifier to Zanzana tuples
// - Special handling for folder resource tuples (which need to be merged)
// - Deduplication of tuples
//
// Returns a slice of tuples ready to be written to Zanzana, or nil if no valid tuples could be created.
func ConvertRolePermissionsToTuples(roleUID string, permissions []RolePermission) ([]*openfgav1.TupleKey, error) {
	if len(permissions) == 0 {
		return nil, nil
	}

	// Subject for role permissions: role:{uid}#assignee
	subject := NewTupleEntry(TypeRole, roleUID, RelationAssignee)

	// Use a map to track tuples, with special handling for folder resource tuples
	tupleMap := make(map[string]*openfgav1.TupleKey)
	folderResourceTuples := make(map[string]*openfgav1.TupleKey) // key is tuple without condition

	for _, perm := range permissions {
		// Convert RBAC action/kind to Zanzana tuple
		tuple, ok := TranslateToResourceTuple(subject, perm.Action, perm.Kind, perm.Identifier)
		if !ok {
			// Skip permissions that can't be translated
			log.New("zanzana").Warn("skipping permission that can't be translated", "permission", perm)
			continue
		}

		// Handle folder resource tuples specially - they need to be merged
		if IsFolderResourceTuple(tuple) {
			// Create a key without the condition for deduplication
			key := TupleStringWithoutCondition(tuple)
			if existing, exists := folderResourceTuples[key]; exists {
				// Merge this tuple with the existing one
				MergeFolderResourceTuples(existing, tuple)
			} else {
				folderResourceTuples[key] = tuple
			}
			continue
		}

		// For non-folder resource tuples, just add to the map
		tupleMap[tuple.String()] = tuple
	}

	// Collect all tuples
	tuples := make([]*openfgav1.TupleKey, 0, len(tupleMap)+len(folderResourceTuples))
	for _, t := range tupleMap {
		tuples = append(tuples, t)
	}
	for _, t := range folderResourceTuples {
		tuples = append(tuples, t)
	}

	return tuples, nil
}
