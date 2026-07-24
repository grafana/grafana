package resources

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceIdentifier uniquely identifies a resource for takeover allowlisting
// during migration. It is keyed by name, group, and kind.
type ResourceIdentifier struct {
	Name  string
	Group string
	Kind  string
}

// TakeoverAllowlist is an immutable, concurrency-safe set of resource
// identifiers that the sync phase is permitted to claim even when they
// are currently unmanaged. Build it once via NewTakeoverAllowlist and
// then share freely across goroutines -- only read access is exposed.
type TakeoverAllowlist struct {
	ids map[ResourceIdentifier]struct{}
}

// NewTakeoverAllowlist creates an immutable allowlist from the given set.
// The map is defensively copied so the caller is free to mutate ids afterwards.
func NewTakeoverAllowlist(ids map[ResourceIdentifier]struct{}) *TakeoverAllowlist {
	cp := make(map[ResourceIdentifier]struct{}, len(ids))
	for k, v := range ids {
		cp[k] = v
	}
	return &TakeoverAllowlist{ids: cp}
}

// Contains reports whether id is in the allowlist.
func (a *TakeoverAllowlist) Contains(id ResourceIdentifier) bool {
	_, ok := a.ids[id]
	return ok
}

type takeoverAllowlistKey struct{}

// WithTakeoverAllowlist returns a context that carries the given allowlist.
// During sync, CheckResourceOwnership will permit claiming unmanaged
// resources whose identifier is in this set.
func WithTakeoverAllowlist(ctx context.Context, allowlist *TakeoverAllowlist) context.Context {
	return context.WithValue(ctx, takeoverAllowlistKey{}, allowlist)
}

// TakeoverAllowlistFromContext returns the takeover allowlist stored in ctx, or nil.
func TakeoverAllowlistFromContext(ctx context.Context) *TakeoverAllowlist {
	v, _ := ctx.Value(takeoverAllowlistKey{}).(*TakeoverAllowlist)
	return v
}

// CheckResourceOwnership validates that the requesting manager can modify the existing resource.
// Returns an error if the existing resource is owned by a different manager that doesn't allow edits.
// If existingResource is nil, no ownership conflict exists (new resource).
// Unmanaged resources (no manager annotations) are rejected unless their identifier
// appears in the takeover allowlist stored in ctx (set during migration).
func CheckResourceOwnership(ctx context.Context, existingResource *unstructured.Unstructured, resourceName string, requestingManager utils.ManagerProperties) error {
	if existingResource == nil {
		return nil
	}

	existingMeta, err := utils.MetaAccessor(existingResource)
	if err != nil {
		return nil
	}

	currentManager, hasManager := existingMeta.GetManagerProperties()
	if !hasManager {
		if allowlist := TakeoverAllowlistFromContext(ctx); allowlist != nil {
			gvk := existingResource.GroupVersionKind()
			id := ResourceIdentifier{Name: resourceName, Group: gvk.Group, Kind: gvk.Kind}
			if allowlist.Contains(id) {
				return nil
			}
		}
		return NewResourceUnmanagedConflictError(resourceName, requestingManager)
	}

	if currentManager.Kind == requestingManager.Kind && currentManager.Identity == requestingManager.Identity {
		return nil
	}

	if currentManager.AllowsEdits {
		return nil
	}

	return NewResourceOwnershipConflictError(resourceName, currentManager, requestingManager)
}
