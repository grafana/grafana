package legacyannotations

import (
	"context"
	"errors"
	"maps"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Guard applies the write rules for a legacy store's objects, so a store gets them by
// calling three methods rather than reimplementing them:
//
//	guard := legacyannotations.NewGuard[*v0alpha1.DataSource](resourceInfo.GroupResource())
//
//	func (s *store) Create(ctx context.Context, obj *v0alpha1.DataSource) error {
//		return s.guard.OnCreate(ctx, obj)
//	}
//
// T is the store's own object type. The rules only need metav1.Object, so the type
// parameter buys no behaviour -- it buys call sites: a store passes and receives its
// concrete type, with no conversions at the boundary and no interface to assert back
// out of in OnUpdate, where the proposed object is mutated in place.
type Guard[T metav1.Object] struct {
	// Resource names the resource in the errors it returns.
	Resource schema.GroupResource
}

// OnCreate refuses a create whose manager annotations the caller may not assign.
func (g Guard[T]) OnCreate(ctx context.Context, obj T) error {
	if !IsManaged(obj) {
		return nil
	}
	auth, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	return g.forbid(identity.CheckManagerOnCreate(auth, accessorOf(obj)))
}

// OnUpdate prepares and checks an update. It retains the stored annotations when the
// request carries none, then applies the manager rules and the file-provisioning
// policy. proposed is modified in place, so call it before converting to a command.
func (g Guard[T]) OnUpdate(ctx context.Context, proposed, old T) error {
	g.retainOnPut(ctx, proposed, old)

	if IsManaged(proposed) || IsManaged(old) {
		auth, err := identity.GetRequester(ctx)
		if err != nil {
			return err
		}
		if err := g.forbid(identity.CheckManagerOnUpdate(auth, accessorOf(proposed), accessorOf(old))); err != nil {
			return err
		}
	}
	return g.checkFileProvisioned(ctx, old)
}

// OnDelete refuses a delete the manager does not allow.
func (g Guard[T]) OnDelete(ctx context.Context, obj T) error {
	if IsManaged(obj) {
		auth, err := identity.GetRequester(ctx)
		if err != nil {
			return err
		}
		if err := g.forbid(identity.CheckManagerOnDelete(auth, accessorOf(obj))); err != nil {
			return err
		}
	}
	return g.checkFileProvisioned(ctx, obj)
}

// retainOnPut keeps the stored annotations when a PUT carries none.
//
// A PUT replaces the whole object, so an empty annotation map would otherwise read as
// "release this resource". Grafana's own UI sends exactly that for data sources: its
// converter hard-codes an empty map and drops annotations on read, so an ordinary save
// would strip provenance, and an admin -- who is allowed to release a repo-managed
// resource -- would detach it without meaning to.
//
// Removing a manager stays possible with a PATCH that clears the annotations, which
// goes through the same rules as any other manager change.
func (g Guard[T]) retainOnPut(ctx context.Context, proposed, old T) {
	if len(proposed.GetAnnotations()) > 0 || len(old.GetAnnotations()) == 0 {
		return
	}
	if requestInfo, ok := request.RequestInfoFrom(ctx); ok && requestInfo.Verb == "patch" {
		return
	}
	proposed.SetAnnotations(maps.Clone(old.GetAnnotations()))
}

// checkFileProvisioned refuses a write to a resource provisioned from a file whose
// config did not allow edits. See NewGuard for why it is limited to those kinds.
func (g Guard[T]) checkFileProvisioned(ctx context.Context, old T) error {
	manager, managed := accessorOf(old).GetManagerProperties()
	if !managed || manager.AllowsEdits {
		return nil
	}
	if !utils.IsFileProvisioned(manager.Kind) {
		return nil
	}
	if auth, err := identity.GetRequester(ctx); err == nil && identity.IsServiceIdentityAuth(auth) {
		return nil // the provisioner rewriting its own file
	}
	return apierrors.NewForbidden(g.Resource, old.GetName(),
		errors.New("resource is provisioned from a file and its config does not allow edits"))
}

// asForbidden turns the repo-managed sentinel into a 403. Unified storage answers that
// case by re-routing the write to the provisioning files endpoint; a SQL table has
// nowhere to route it, so the caller gets a refusal rather than a bare error.
func (g Guard[T]) forbid(err error) error {
	if !errors.Is(err, identity.ErrResourceIsManagedInRepository) {
		return err
	}
	return apierrors.NewForbidden(g.Resource, "",
		errors.New("this resource is managed by a repository and can not be edited directly"))
}
