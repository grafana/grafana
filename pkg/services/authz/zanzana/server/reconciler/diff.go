package reconciler

import (
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// ComputeDiff compares expected tuples (from CRDs) with current tuples (from Zanzana)
// and returns tuples that need to be added and deleted to bring Zanzana in sync.
// TODO: Optimize for better CPU and memory usage. For now, we're using a naive approach.
func ComputeDiff(expected, current []*openfgav1.TupleKey) (toAdd, toDelete []*openfgav1.TupleKey) {
	// Build maps for efficient lookup
	expectedMap := make(map[string]*openfgav1.TupleKey)
	currentMap := make(map[string]*openfgav1.TupleKey)

	// Index expected tuples
	for _, tuple := range expected {
		key := tupleKey(tuple)
		expectedMap[key] = tuple
	}

	// Index current tuples
	for _, tuple := range current {
		key := tupleKey(tuple)
		currentMap[key] = tuple
	}

	// Find tuples to add (in expected but not in current)
	for key, tuple := range expectedMap {
		if _, exists := currentMap[key]; !exists {
			toAdd = append(toAdd, tuple)
		}
	}

	// Find tuples to delete (in current but not in expected)
	for key, tuple := range currentMap {
		if _, exists := expectedMap[key]; !exists {
			toDelete = append(toDelete, tuple)
		}
	}

	return toAdd, toDelete
}

// tupleKey generates a unique string key for a tuple based on user, relation, and object.
// We ignore conditions in the comparison as they are part of the tuple content.
func tupleKey(tuple *openfgav1.TupleKey) string {
	return tuple.String()
}
