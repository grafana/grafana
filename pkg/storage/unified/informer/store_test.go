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

// Replace swaps the whole set and reports the diff — objects that newly appeared
// (added) and objects that vanished (removed) — so the informer can emit adds and
// deletes for them.
func TestStore_ReplaceReportsDiff(t *testing.T) {
	s := NewStore()
	ctx := context.Background()

	added, removed := s.Replace([]runtime.Object{obj("a"), obj("b")})
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(added), "first replace adds everything")
	assert.Empty(t, removed, "first replace removes nothing")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	// c is new, b vanished, a is unchanged (reported in neither set).
	added, removed = s.Replace([]runtime.Object{obj("a"), obj("c")})
	assert.Equal(t, []string{"c"}, storeNames(added), "c newly appeared and must be reported as added")
	assert.Equal(t, []string{"b"}, storeNames(removed), "b vanished and must be reported as removed")
	assert.ElementsMatch(t, []string{"a", "c"}, storeNames(s.List(ctx)))
}

// Merge upserts without removing anything absent — the partial-re-list path — and
// reports only the keys that were newly added, so a truncated list never makes
// its unread objects look deleted.
func TestStore_MergeUpsertsWithoutRemoving(t *testing.T) {
	s := NewStore()
	ctx := context.Background()

	added := s.Merge([]runtime.Object{obj("a"), obj("b")})
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(added), "first merge adds everything")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	// c is new; a is re-observed (not reported); b is absent from this merge but
	// must survive — Merge never removes.
	added = s.Merge([]runtime.Object{obj("a"), obj("c")})
	assert.Equal(t, []string{"c"}, storeNames(added), "only the newly-seen key is reported as added")
	assert.ElementsMatch(t, []string{"a", "b", "c"}, storeNames(s.List(ctx)), "a merge never drops an absent key")
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
