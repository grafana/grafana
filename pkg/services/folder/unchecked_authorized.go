package folder

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrUncheckedDeleteNotAuthorized means an Unchecked method ran without the marker -- a wiring bug, not a permission problem.
var ErrUncheckedDeleteNotAuthorized = errors.New("unchecked delete called without going through a sanctioned entry point")

type uncheckedDeleteAuthorizedKey struct{}

// uncheckedDeleteScope is the (orgID, namespace, requester UID, authorized folder UIDs) a marked ctx was authorized for; namespace is included because stacks-<id> namespaces all share legacy OrgID 1. folderUIDs is a set, not an exact batch: a checked caller that authorizes a batch (e.g. ["a","b"]) may delegate to callees that each check only their own folder ("a", or "b") against that same marker, so membership -- not exact-set equality -- is what's checked.
type uncheckedDeleteScope struct {
	valid      bool
	orgID      int64
	namespace  string
	userUID    string
	folderUIDs map[string]struct{}
}

// WithUncheckedDeleteAuthorized marks ctx as authorized for an Unchecked delete of folderUIDs by user in orgID; checked must be the caller's own permission-check result, not a hardcoded true. A false checked, or a nil/typed-nil user, explicitly invalidates any marker already on ctx instead of leaving it unchanged, in case ctx was previously (and is no longer) authorized.
func WithUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester, folderUIDs []string, checked bool) context.Context {
	if !checked || user == nil || user.IsNil() {
		return context.WithValue(ctx, uncheckedDeleteAuthorizedKey{}, uncheckedDeleteScope{})
	}
	set := make(map[string]struct{}, len(folderUIDs))
	for _, uid := range folderUIDs {
		set[uid] = struct{}{}
	}
	return context.WithValue(ctx, uncheckedDeleteAuthorizedKey{},
		uncheckedDeleteScope{valid: true, orgID: orgID, namespace: user.GetNamespace(), userUID: user.GetUID(), folderUIDs: set})
}

// IsUncheckedDeleteAuthorized reports whether ctx is marked for this orgID and user, and every one of folderUIDs is in the authorized set; namespace is compared by exact equality, not claims.NamespaceMatches's "*" wildcard.
func IsUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester, folderUIDs []string) bool {
	if user == nil || user.IsNil() {
		return false
	}
	v, ok := ctx.Value(uncheckedDeleteAuthorizedKey{}).(uncheckedDeleteScope)
	if !ok || !v.valid || v.orgID != orgID || v.namespace != user.GetNamespace() || v.userUID != user.GetUID() {
		return false
	}
	for _, uid := range folderUIDs {
		if _, authorized := v.folderUIDs[uid]; !authorized {
			return false
		}
	}
	return true
}

// RequireUncheckedDeleteAuthorized is the guard every exported Unchecked delete entry point must run first; it does not cover internal, reconciler-driven cleanup paths that call lower-level unexported functions directly.
func RequireUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester, folderUIDs []string) error {
	if !IsUncheckedDeleteAuthorized(ctx, orgID, user, folderUIDs) {
		return ErrUncheckedDeleteNotAuthorized
	}
	return nil
}
