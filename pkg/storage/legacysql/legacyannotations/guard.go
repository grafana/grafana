package legacyannotations

import (
	"context"
	"errors"
	"maps"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Guard applies the write rules for a legacy store's objects, so a store gets them by
// calling three methods rather than reimplementing them. It guards the k8s API only: a
// writer that calls the datasource service directly does not pass through it.
//
//	guard := legacyannotations.Guard{Resource: resourceInfo.GroupResource()}
//
//	func (s *store) Create(ctx context.Context, obj *v0alpha1.DataSource) error {
//		return guard.OnCreate(ctx, obj)
//	}
type Guard struct {
	// Resource names the resource in the errors it returns.
	Resource schema.GroupResource
}

// OnCreate refuses a create whose manager annotations the caller may not assign.
func (g Guard) OnCreate(ctx context.Context, obj metav1.Object) error {
	if !isManaged(obj) {
		return nil
	}
	auth, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	if err := g.forbid(identity.CheckManagerOnCreate(auth, accessorOf(obj))); err != nil {
		return err
	}
	return g.checkFileProvisionedAssignment(auth, obj, nil)
}

// OnUpdate refuses an update the manager rules or the file-provisioning policy do not
// allow.
func (g Guard) OnUpdate(ctx context.Context, proposed, old metav1.Object) error {
	if isManaged(proposed) || isManaged(old) {
		auth, err := identity.GetRequester(ctx)
		if err != nil {
			return err
		}
		if err := g.forbid(identity.CheckManagerOnUpdate(auth, accessorOf(proposed), accessorOf(old))); err != nil {
			return err
		}
		if err := g.checkFileProvisionedAssignment(auth, proposed, old); err != nil {
			return err
		}
	}
	return g.checkFileProvisioned(ctx, old)
}

// OnDelete refuses a delete the manager does not allow.
func (g Guard) OnDelete(ctx context.Context, obj metav1.Object) error {
	if isManaged(obj) {
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

// RetainOnPut keeps the stored annotations when a PUT carries none.
//
// A PUT replaces the whole object, so an empty annotation map would otherwise read as
// "release this resource". Grafana's own UI sends exactly that for data sources: its
// converter hard-codes an empty map and drops annotations on read, so an ordinary save
// would strip provenance, and an admin -- who is allowed to release a repo-managed
// resource -- would detach it without meaning to.
//
// It exists for UI clients that cannot yet send annotations; remove it when they do.
// Call it from admission, which runs once per store: during dual write the legacy and
// the unified copy are each updated from the same request, and retaining on only one
// of them leaves the other released. Removing a manager stays possible with a PATCH
// that clears the annotations, which goes through the same rules as any other change.
func RetainOnPut(ctx context.Context, proposed, old metav1.Object) {
	if len(proposed.GetAnnotations()) > 0 || len(old.GetAnnotations()) == 0 {
		return
	}
	if requestInfo, ok := request.RequestInfoFrom(ctx); ok && requestInfo.Verb == "patch" {
		return
	}
	proposed.SetAnnotations(maps.Clone(old.GetAnnotations()))
}

// checkFileProvisionedAssignment refuses a caller other than the provisioner assigning a
// file-provisioned manager, which would make a resource nobody else can edit or delete.
func (g Guard) checkFileProvisionedAssignment(auth authtypes.AuthInfo, proposed, old metav1.Object) error {
	kind := utils.ParseManagerKindString(proposed.GetAnnotations()[utils.AnnoKeyManagerKind])
	if !utils.IsFileProvisioned(kind) || identity.IsServiceIdentityAuth(auth) {
		return nil
	}
	if old != nil && utils.ParseManagerKindString(old.GetAnnotations()[utils.AnnoKeyManagerKind]) == kind {
		return nil // already assigned
	}
	return apierrors.NewForbidden(g.Resource, proposed.GetName(),
		errors.New("only the file provisioner may assign this resource manager"))
}

// checkFileProvisioned refuses a write to a resource provisioned from a file whose
// config did not allow edits. See utils.IsFileProvisioned for why it is limited to those kinds.
func (g Guard) checkFileProvisioned(ctx context.Context, old metav1.Object) error {
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

// forbid turns the repo-managed sentinel into a 403. Unified storage answers that
// case by re-routing the write to the provisioning files endpoint; a SQL table has
// nowhere to route it, so the caller gets a refusal rather than a bare error.
func (g Guard) forbid(err error) error {
	if !errors.Is(err, identity.ErrResourceIsManagedInRepository) {
		return err
	}
	return apierrors.NewForbidden(g.Resource, "",
		errors.New("this resource is managed by a repository and can not be edited directly"))
}

// isManaged reports whether obj names a manager, so a gate knows whether it has to
// run. See utils.HasManager for why this is not GetManagerProperties.
func isManaged(obj metav1.Object) bool {
	return utils.HasManager(obj.GetAnnotations())
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
