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
	"context"
	"errors"
	"maps"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Policy describes which annotations a legacy SQL table stores in its annotation
// column, by listing the ones it does not: those it derives from real columns.
type Policy struct {
	derived map[string]bool
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
		if !p.derived[k] {
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
		if p.derived[k] {
			continue
		}
		if _, exists := annotations[k]; exists {
			continue
		}
		annotations[k] = v
	}
	obj.SetAnnotations(annotations)
}

// CheckManagerOnCreate, CheckManagerOnUpdate and CheckManagerOnDelete apply the same
// manager gates unified storage applies on every write, so the SQL path is not a way
// around them. They differ from the unified versions in two respects. Unified storage
// answers a write to a repo-managed resource by re-routing it to the provisioning
// files endpoint, and a SQL table has nowhere to route it, so that case is a 403 here.
// And an unmanaged write is not gated at all, so these resolve the requester only once
// a manager is actually involved: a write that was never gated must not start
// requiring an identity it never needed.

func CheckManagerOnCreate(ctx context.Context, obj metav1.Object) error {
	if !IsManaged(obj) {
		return nil
	}
	auth, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	return asForbidden(utils.CheckManagerOnCreate(auth, accessorOf(obj)))
}

func CheckManagerOnUpdate(ctx context.Context, proposed, old metav1.Object) error {
	if !IsManaged(proposed) && !IsManaged(old) {
		return nil
	}
	auth, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	return asForbidden(utils.CheckManagerOnUpdate(auth, accessorOf(proposed), accessorOf(old)))
}

func CheckManagerOnDelete(ctx context.Context, obj metav1.Object) error {
	if !IsManaged(obj) {
		return nil
	}
	auth, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	return asForbidden(utils.CheckManagerOnDelete(auth, accessorOf(obj)))
}

// IsManaged reports whether obj carries manager annotations.
func IsManaged(obj metav1.Object) bool {
	_, managed := accessorOf(obj).GetManagerProperties()
	return managed
}

func asForbidden(err error) error {
	if !errors.Is(err, utils.ErrResourceIsManagedInRepository) {
		return err
	}
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: "This resource is managed by a repository and can not be edited directly",
	}}
}

func accessorOf(obj metav1.Object) utils.GrafanaMetaAccessor {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return emptyAccessor{} // only a nil object fails here
	}
	return meta
}

// emptyAccessor stands in for a nil object so the checks see an unmanaged resource
// rather than panicking.
type emptyAccessor struct {
	utils.GrafanaMetaAccessor
}

func (emptyAccessor) GetAnnotations() map[string]string { return nil }

func (emptyAccessor) GetManagerProperties() (utils.ManagerProperties, bool) {
	return utils.ManagerProperties{}, false
}

func (emptyAccessor) GetAnnotation(string) string { return "" }
