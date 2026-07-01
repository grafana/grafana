package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func storeNames(objs []runtime.Object) []string {
	out := make([]string, len(objs))
	for i, o := range objs {
		out[i] = o.(*metav1.PartialObjectMetadata).Name
	}
	return out
}

// Replace swaps the whole set and reports the objects that vanished, so the
// informer can emit deletes for them.
func TestStore_ReplaceReportsRemoved(t *testing.T) {
	s := NewStore()
	ctx := context.Background()

	assert.Empty(t, s.Replace([]runtime.Object{obj("a"), obj("b")}), "first replace removes nothing")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	removed := s.Replace([]runtime.Object{obj("a")})
	assert.Equal(t, []string{"b"}, storeNames(removed), "b vanished and must be reported")
	assert.Equal(t, []string{"a"}, storeNames(s.List(ctx)))
}

// Update and Delete are the write-throughs that keep the store warm between
// re-lists; List reflects them immediately.
func TestStore_WriteThrough(t *testing.T) {
	s := NewStore()
	ctx := context.Background()
	s.Replace([]runtime.Object{obj("a")})

	s.Update(ctx, obj("b"))
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	s.Delete(ctx, testNamespace, "a")
	assert.Equal(t, []string{"b"}, storeNames(s.List(ctx)))
}

func TestStore_ListEmpty(t *testing.T) {
	assert.Empty(t, NewStore().List(context.Background()))
}
