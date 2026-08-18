package coordination

import (
	"context"
	"regexp"
	"strings"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

const (
	// annotationOwner records the exact service identity (typed UID, e.g.
	// "access-policy:mt-reporting") that created a lease. It is authoritative for
	// ownership checks — set by the server on create, never trusted from the client.
	annotationOwner = "coordination.grafana.app/owner-id"
	// labelOwner mirrors the owner as a label-safe value so operators can select a
	// single service's leases with `kubectl get leases.coordination.grafana.app -l
	// coordination.grafana.app/owner=<svc>`. It is a convenience, not the authz source.
	labelOwner = "coordination.grafana.app/owner"
)

// leaseStorageAuthorizer is the storage-level authorizer for the cluster-scoped
// Lease kind. Cluster scope is a single global keyspace shared across every stack,
// so this authorizer does two things:
//
//  1. Fleet gate — only Grafana admins and service identities (service accounts /
//     access policies) may touch the kind at all; tenant tokens are denied for
//     read, write, and watch. Fail-closed.
//  2. Owner scoping — among service identities, each lease is owned by the service
//     that created it. A service may only get/update/delete its own leases, and
//     list/watch return only its own. Grafana admins bypass owner scoping so they
//     can inspect and administer the whole keyspace.
type leaseStorageAuthorizer struct {
	logger log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*leaseStorageAuthorizer)(nil)

// caller returns the requester and its owner key, after enforcing the fleet gate.
func (a *leaseStorageAuthorizer) caller(ctx context.Context) (identity.Requester, string, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, "", storewrapper.ErrUnauthorized
	}
	if !isServiceIdentity(requester) {
		return nil, "", storewrapper.ErrUnauthorized
	}
	return requester, requester.GetUID(), nil
}

func (a *leaseStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	_, owner, err := a.caller(ctx)
	if err != nil {
		return err
	}
	// Stamp ownership from the authenticated caller, overwriting anything the client
	// supplied. This is what makes a lease "belong" to the service that created it.
	return setOwner(obj, owner)
}

func (a *leaseStorageAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	requester, owner, err := a.caller(ctx)
	if err != nil {
		return err
	}
	existing := getOwner(oldObj)
	if !requester.GetIsGrafanaAdmin() && existing != "" && existing != owner {
		// A different service cannot renew or steal another service's lease.
		return storewrapper.ErrUnauthorized
	}
	// Preserve the original owner so ownership can't be reassigned via update.
	keep := existing
	if keep == "" {
		keep = owner
	}
	return setOwner(obj, keep)
}

func (a *leaseStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return a.checkOwned(ctx, obj)
}

func (a *leaseStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return a.checkOwned(ctx, obj)
}

// checkOwned allows the operation only if the caller is a Grafana admin or the
// object's owner.
func (a *leaseStorageAuthorizer) checkOwned(ctx context.Context, obj runtime.Object) error {
	requester, owner, err := a.caller(ctx)
	if err != nil {
		return err
	}
	if requester.GetIsGrafanaAdmin() {
		return nil
	}
	if getOwner(obj) != owner {
		return storewrapper.ErrUnauthorized
	}
	return nil
}

func (a *leaseStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	requester, owner, err := a.caller(ctx)
	if err != nil {
		return nil, err
	}
	if requester.GetIsGrafanaAdmin() {
		return list, nil
	}
	items, err := meta.ExtractList(list)
	if err != nil {
		return nil, err
	}
	kept := make([]runtime.Object, 0, len(items))
	for _, item := range items {
		if getOwner(item) == owner {
			kept = append(kept, item)
		}
	}
	if err := meta.SetList(list, kept); err != nil {
		return nil, err
	}
	return list, nil
}

func (a *leaseStorageAuthorizer) WatchFilter(ctx context.Context) (storewrapper.WatchEventFilter, error) {
	requester, owner, err := a.caller(ctx)
	if err != nil {
		// Fail-closed: the wrapper refuses to start the watch on a nil filter.
		return storewrapper.RejectAllWatchFilter, err
	}
	if requester.GetIsGrafanaAdmin() {
		return storewrapper.PassThroughWatchFilter, nil
	}
	// Per-event filter: a service only observes changes to leases it owns.
	return func(events []watch.Event) ([]bool, error) {
		keep := make([]bool, len(events))
		for i, ev := range events {
			keep[i] = getOwner(ev.Object) == owner
		}
		return keep, nil
	}, nil
}

// getOwner reads the authoritative owner identity from an object's annotations.
func getOwner(obj runtime.Object) string {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return ""
	}
	return accessor.GetAnnotations()[annotationOwner]
}

// setOwner records the owner as both an authoritative annotation (exact UID) and a
// label-safe label (for `kubectl -l` selection).
func setOwner(obj runtime.Object, owner string) error {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return err
	}
	annotations := accessor.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[annotationOwner] = owner
	accessor.SetAnnotations(annotations)

	labels := accessor.GetLabels()
	if labels == nil {
		labels = map[string]string{}
	}
	labels[labelOwner] = sanitizeLabelValue(owner)
	accessor.SetLabels(labels)
	return nil
}

var invalidLabelChars = regexp.MustCompile(`[^A-Za-z0-9._-]`)

// sanitizeLabelValue maps an identity UID (which may contain ':' and other
// characters invalid in a label value) to a Kubernetes-label-safe form. It is
// best-effort for selection convenience only; the authoritative check uses the
// exact UID stored in the annotation, so sanitized collisions never widen access.
func sanitizeLabelValue(v string) string {
	v = invalidLabelChars.ReplaceAllString(v, "-")
	v = strings.Trim(v, "-._")
	if len(v) > 63 {
		v = strings.Trim(v[:63], "-._")
	}
	return v
}
