package folder

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrUncheckedDeleteNotAuthorized means an Unchecked method ran without the marker -- a wiring bug, not a permission problem.
var ErrUncheckedDeleteNotAuthorized = errors.New("unchecked delete called without going through a sanctioned entry point")

type uncheckedDeleteAuthorizedKey struct{}

// uncheckedDeleteScope is the (orgID, namespace, requester UID) a marked ctx was authorized for; namespace is included because stacks-<id> namespaces all share legacy OrgID 1.
type uncheckedDeleteScope struct {
	orgID     int64
	namespace string
	userUID   string
}

// WithUncheckedDeleteAuthorized marks ctx as authorized for an Unchecked delete by user in orgID; checked must be the caller's own permission-check result, not a hardcoded true. A false checked, or a nil/typed-nil user, leaves ctx unmarked.
func WithUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester, checked bool) context.Context {
	if !checked || user == nil || user.IsNil() {
		return ctx
	}
	return context.WithValue(ctx, uncheckedDeleteAuthorizedKey{},
		uncheckedDeleteScope{orgID: orgID, namespace: user.GetNamespace(), userUID: user.GetUID()})
}

// IsUncheckedDeleteAuthorized reports whether ctx is marked for this same orgID and user; namespace is compared by exact equality, not claims.NamespaceMatches's "*" wildcard.
func IsUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester) bool {
	if user == nil || user.IsNil() {
		return false
	}
	v, ok := ctx.Value(uncheckedDeleteAuthorizedKey{}).(uncheckedDeleteScope)
	return ok && v.orgID == orgID && v.namespace == user.GetNamespace() && v.userUID == user.GetUID()
}

// RequireUncheckedDeleteAuthorized is the guard every Unchecked delete entry point must run first.
func RequireUncheckedDeleteAuthorized(ctx context.Context, orgID int64, user identity.Requester) error {
	if !IsUncheckedDeleteAuthorized(ctx, orgID, user) {
		return ErrUncheckedDeleteNotAuthorized
	}
	return nil
}
