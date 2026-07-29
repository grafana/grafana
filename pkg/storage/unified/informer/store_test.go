package informer

import (
	"context"
	"strconv"
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

// objRV is obj tagged with a resource version, for exercising the RV-aware
// reconciliation Replace does against live write-throughs.
func objRV(name string, rv int64) *metav1.PartialObjectMetadata {
	o := obj(name)
	o.ResourceVersion = strconv.FormatInt(rv, 10)
	return o
}

// Replace swaps the whole set and reports the diff — objects that newly appeared
// (added), objects present before and now (updated), and objects that vanished
// (removed) — so the informer can emit adds, updates, and deletes for them.
func TestStore_ReplaceReportsDiff(t *testing.T) {
	s := NewStore()
	ctx := context.Background()

	added, updated, removed := s.Replace([]runtime.Object{obj("a"), obj("b")}, 0)
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(added), "first replace adds everything")
	assert.Empty(t, updated, "first replace updates nothing")
	assert.Empty(t, removed, "first replace removes nothing")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	// c is new, b vanished, a is retained.
	added, updated, removed = s.Replace([]runtime.Object{obj("a"), obj("c")}, 0)
	assert.Equal(t, []string{"c"}, storeNames(added), "c newly appeared and must be reported as added")
	assert.Equal(t, []string{"a"}, storeNames(updated), "a was present before and now must be reported as updated")
	assert.Equal(t, []string{"b"}, storeNames(removed), "b vanished and must be reported as removed")
	assert.ElementsMatch(t, []string{"a", "c"}, storeNames(s.List(ctx)))
}

// Update and Delete are the write-throughs that keep the store warm between
// re-lists; List reflects them immediately.
func TestStore_WriteThrough(t *testing.T) {
	s := NewStore()
	ctx := context.Background()
	s.Replace([]runtime.Object{obj("a")}, 0)

	s.Update(ctx, obj("b"))
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)))

	s.Delete(ctx, testNamespace, "a")
	assert.Equal(t, []string{"b"}, storeNames(s.List(ctx)))
}

// A live write (Update) newer than the LIST snapshot is carried forward by
// Replace rather than reported removed: the subscription is open while the LIST
// runs, so a write can land after the snapshot was read, and the snapshot's
// silence about it is stale, not authoritative. Regression test for the
// live-add / re-list race.
func TestStore_ReplaceCarriesForwardLiveWriteNewerThanSnapshot(t *testing.T) {
	s := NewStore()
	ctx := context.Background()
	s.Replace([]runtime.Object{objRV("a", 100)}, 100)

	// "b" is live-added at rv 200 — after a snapshot the next re-list reads at 150.
	s.Update(ctx, objRV("b", 200))

	added, updated, removed := s.Replace([]runtime.Object{objRV("a", 100)}, 150)
	assert.Empty(t, added)
	assert.Equal(t, []string{"a"}, storeNames(updated))
	assert.Empty(t, removed, "a live write newer than the snapshot must not be reported removed")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(s.List(ctx)), "b is carried forward")

	// A later snapshot that postdates the write lists b — a normal retained update.
	added, updated, _ = s.Replace([]runtime.Object{objRV("a", 100), objRV("b", 200)}, 250)
	assert.Empty(t, added, "b is already in the store, not a new add")
	assert.ElementsMatch(t, []string{"a", "b"}, storeNames(updated))
}

// A live delete newer than the LIST snapshot is honored by Replace: an object
// the snapshot still lists (because the snapshot predates the delete) is
// suppressed, not resurrected as a spurious add. Once a snapshot postdates the
// delete the tombstone is spent, so a genuine later re-create adds normally.
// Regression test for the live-delete / re-list race.
func TestStore_ReplaceSuppressesResurrectionOfLiveDeleted(t *testing.T) {
	s := NewStore()
	ctx := context.Background()
	s.Replace([]runtime.Object{objRV("a", 100), objRV("x", 120)}, 120)

	// x is live-deleted at rv 200.
	s.DeleteAt(ctx, testNamespace, "x", 200)
	assert.Equal(t, []string{"a"}, storeNames(s.List(ctx)))

	// A stale snapshot (rv 150, predating the delete) still lists x; it must not
	// be resurrected.
	added, _, removed := s.Replace([]runtime.Object{objRV("a", 100), objRV("x", 120)}, 150)
	assert.Empty(t, added, "the stale snapshot must not resurrect the live-deleted object")
	assert.Empty(t, removed)
	assert.Equal(t, []string{"a"}, storeNames(s.List(ctx)), "x stays evicted")

	// A fresh snapshot postdating the delete no longer lists x, spending the
	// tombstone; a later re-create at a higher version is then a real add.
	s.Replace([]runtime.Object{objRV("a", 100)}, 250)
	added, _, _ = s.Replace([]runtime.Object{objRV("a", 100), objRV("x", 300)}, 300)
	assert.Equal(t, []string{"x"}, storeNames(added), "a re-create after the tombstone is spent is a real add")
}

// A reader's Delete (a NotFound it cannot date) records no tombstone, so it does
// not suppress a re-list that legitimately lists the object — only the informer's
// version-dated DeleteAt guards against resurrection.
func TestStore_ReaderDeleteLeavesNoTombstone(t *testing.T) {
	s := NewStore()
	ctx := context.Background()
	s.Replace([]runtime.Object{objRV("a", 100)}, 100)

	s.Delete(ctx, testNamespace, "a")
	assert.Empty(t, storeNames(s.List(ctx)))

	added, _, _ := s.Replace([]runtime.Object{objRV("a", 100)}, 150)
	assert.Equal(t, []string{"a"}, storeNames(added), "a reader delete must not suppress a legitimate re-list")
}

func TestStore_ListEmpty(t *testing.T) {
	assert.Empty(t, NewStore().List(context.Background()))
}
