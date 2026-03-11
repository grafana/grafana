package reconciler

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
)

func makeTuple(user, relation, object string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{User: user, Relation: relation, Object: object}
}

func makeTupleWithCondition(user, relation, object, condition string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User: user, Relation: relation, Object: object,
		Condition: &openfgav1.RelationshipCondition{Name: condition},
	}
}

func TestTupleKey(t *testing.T) {
	t.Run("different fields produce different keys", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTuple("user:2", "viewer", "doc:1"))
		c := tupleKey(makeTuple("user:1", "editor", "doc:1"))
		d := tupleKey(makeTuple("user:1", "viewer", "doc:2"))

		assert.NotEqual(t, a, b)
		assert.NotEqual(t, a, c)
		assert.NotEqual(t, a, d)
	})

	t.Run("same fields produce same key", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		assert.Equal(t, a, b)
	})

	t.Run("condition is ignored", func(t *testing.T) {
		a := tupleKey(makeTuple("user:1", "viewer", "doc:1"))
		b := tupleKey(makeTupleWithCondition("user:1", "viewer", "doc:1", "some_condition"))
		assert.Equal(t, a, b)
	})

	t.Run("null byte separator prevents collisions", func(t *testing.T) {
		a := tupleKey(makeTuple("ab", "c", "d"))
		b := tupleKey(makeTuple("a", "bc", "d"))
		assert.NotEqual(t, a, b)
	})
}
