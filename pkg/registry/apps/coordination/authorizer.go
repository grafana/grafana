package coordination

import (
	"context"
	"regexp"
	"strings"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
// ClusterLease. Cluster scope is a single global keyspace shared across every stack,
// so this authorizer does two things:
//
//  1. Access gate (fail-closed) — Grafana admins and service identities are allowed
//     on the fast path; any other identity needs a fine-grained RBAC action
//     (coordination.clusterleases:read / :write) granted by a role. It gates read,
//     write, and watch.
//  2. Owner scoping — each lease is owned by the service that created it. A service
//     identity may only get/update/delete its own leases, and list/watch return only
//     its own. Grafana admins and RBAC-granted (non-service) identities bypass owner
//     scoping so they can inspect and administer the whole keyspace.
type leaseStorageAuthorizer struct {
	logger        log.Logger
	accessControl accesscontrol.AccessControl
}

var _ storewrapper.ResourceStorageAuthorizer = (*leaseStorageAuthorizer)(nil)

// authorize enforces access for an operation needing `action` and returns the
// caller's owner key and whether results must be owner-scoped.
func (a *leaseStorageAuthorizer) authorize(ctx context.Context, action string) (owner string, ownerScoped bool, err error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return "", false, storewrapper.ErrUnauthorized
	}
	// Grafana admins have unscoped access.
	if requester.GetIsGrafanaAdmin() {
		return requester.GetUID(), false, nil
	}
	// Service identities (operators) are allowed and owner-scoped, so one service
	// never sees or touches another's leases.
	if requester.IsIdentityType(claims.TypeServiceAccount, claims.TypeAccessPolicy) {
		return requester.GetUID(), true, nil
	}
	// Everyone else needs the fine-grained RBAC action; a granted identity is not
	// owner-scoped (it never owns leases and is trusted to see the whole keyspace).
	if a.accessControl != nil {
		hasAccess, evalErr := a.accessControl.Evaluate(ctx, requester, accesscontrol.EvalPermission(action))
		if evalErr == nil && hasAccess {
			return requester.GetUID(), false, nil
		}
	}
	return "", false, storewrapper.ErrUnauthorized
}

func (a *leaseStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	owner, _, err := a.authorize(ctx, ActionClusterLeasesWrite)
	if err != nil {
		return err
	}
	// Stamp ownership from the authenticated caller, overwriting anything the client
	// supplied. This is what makes a lease "belong" to the service that created it.
	return setOwner(obj, owner)
}

func (a *leaseStorageAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	owner, ownerScoped, err := a.authorize(ctx, ActionClusterLeasesWrite)
	if err != nil {
		return err
	}
	existing := getOwner(oldObj)
	if ownerScoped && existing != "" && existing != owner {
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
	return a.checkOwned(ctx, ActionClusterLeasesWrite, obj)
}

func (a *leaseStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return a.checkOwned(ctx, ActionClusterLeasesRead, obj)
}

// checkOwned allows the operation only if the caller is authorized and, when
// owner-scoped, owns the object.
func (a *leaseStorageAuthorizer) checkOwned(ctx context.Context, action string, obj runtime.Object) error {
	owner, ownerScoped, err := a.authorize(ctx, action)
	if err != nil {
		return err
	}
	if ownerScoped && getOwner(obj) != owner {
		return storewrapper.ErrUnauthorized
	}
	return nil
}

func (a *leaseStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	owner, ownerScoped, err := a.authorize(ctx, ActionClusterLeasesRead)
	if err != nil {
		return nil, err
	}
	if !ownerScoped {
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
	owner, ownerScoped, err := a.authorize(ctx, ActionClusterLeasesRead)
	if err != nil {
		// Fail-closed: the wrapper refuses to start the watch on a nil filter.
		return storewrapper.RejectAllWatchFilter, err
	}
	if !ownerScoped {
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
