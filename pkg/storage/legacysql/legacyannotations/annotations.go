// Package legacyannotations keeps metadata.annotations for resources whose
// authoritative storage is still a legacy SQL table.
//
// A legacy table predates the app platform API, so it has a column per field it
// knew about and nowhere to put the annotations the API adds on top -- manager
// properties, source properties, and whatever comes next. Without somewhere to put
// them the converter has to drop them, which loses the manager even in dual write:
// the unified copy of a create is built from the object legacy returned.
//
// The fix is one nullable text column per table holding the annotations the table
// does not already model, and a Policy saying which those are. What differs between
// resources is only that set: a data source derives its updated timestamp from a
// column, a dashboard additionally derives its folder, message and manager from
// columns of its own. Everything here takes a metav1.Object, which both the typed
// and the unstructured form of every resource already satisfies.
//
// # Writing
//
// A legacy update command must say whether its caller knows about annotations at
// all. One that does -- a k8s PUT, a provisioner rewriting its own files -- is
// authoritative: the annotations are written as given, and dropping them releases
// the resource. One that does not -- the legacy HTTP API, a targeted column update --
// must leave the stored annotations alone rather than clear them by omission.
//
// With xorm that distinction is the difference between letting an empty map fall
// through the zero-value skip and forcing the column with MustCols:
//
//	if cmd.UpdateAnnotations {
//		sess.MustCols("annotations")
//	}
//
// Getting this wrong is not theoretical: is_prunable is UseBool'd and never set by
// pkg/api/datasources.go, so every legacy data source edit silently zeroes it.
package legacyannotations

import (
	"maps"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Policy describes which annotations a legacy SQL table stores in its annotation
// column, by listing the ones it does not: those it derives from real columns.
type Policy struct {
	derived map[string]bool
	dropped map[string]bool
}

// NewPolicy returns a Policy for a table that derives the named annotations from
// its own columns. Everything else is stored verbatim, so an annotation added to
// the API later needs no migration and no change here.
func NewPolicy(derived ...string) Policy {
	keys := make(map[string]bool, len(derived))
	for _, k := range derived {
		keys[k] = true
	}
	return Policy{derived: keys}
}

// Dropping returns a copy of p that never stores the named annotations at all.
// Unlike a derived annotation, a dropped one has no column behind it and does not
// come back on read: the row is the wrong place for it. An annotation a client can
// fill with content the column is not allowed to hold -- a secret, or a copy of the
// whole object -- belongs here.
func (p Policy) Dropping(keys ...string) Policy {
	dropped := make(map[string]bool, len(p.dropped)+len(keys))
	maps.Copy(dropped, p.dropped)
	for _, k := range keys {
		dropped[k] = true
	}
	return Policy{derived: p.derived, dropped: dropped}
}

// Derives reports whether key comes from a column rather than the annotation blob.
func (p Policy) Derives(key string) bool {
	return p.derived[key]
}

// ToStore returns the annotations of obj to persist in the annotation column, which
// is all of them except the derived ones. Persisting a derived annotation as well
// would let the row disagree with itself once the column it mirrors changes.
//
// Returns nil when nothing is left to store, so an unmanaged resource writes NULL
// rather than an empty JSON object.
func (p Policy) ToStore(obj metav1.Object) map[string]string {
	annotations := obj.GetAnnotations()
	stored := make(map[string]string, len(annotations))
	for k, v := range annotations {
		if !p.derived[k] && !p.dropped[k] {
			stored[k] = v
		}
	}
	if len(stored) == 0 {
		return nil
	}
	return stored
}

// Apply merges stored annotations onto obj. Derived annotations are skipped, and so
// is any key the caller has already set from a column, so Apply can run before or
// after the rest of the conversion and a stale stored copy can never win over the
// column it mirrors.
func (p Policy) Apply(obj metav1.Object, stored map[string]string) {
	if len(stored) == 0 {
		return
	}

	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string, len(stored))
	} else {
		annotations = maps.Clone(annotations)
	}

	for k, v := range stored {
		if p.derived[k] || p.dropped[k] {
			continue
		}
		if _, exists := annotations[k]; exists {
			continue
		}
		annotations[k] = v
	}
	obj.SetAnnotations(annotations)
}
