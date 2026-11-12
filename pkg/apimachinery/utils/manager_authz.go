package utils

import (
	"errors"
	"fmt"
	"net/http"

	authtypes "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrResourceIsManagedInRepository reports that a write targets a repo-managed
// resource. Unified storage re-routes such a write to the provisioning files
// endpoint; storage that cannot route it should turn this into a 403.
var ErrResourceIsManagedInRepository = errors.New("this resource is managed by a repository")

// CheckSameRepoManager refuses a resource whose manager disagrees with the manager
// of the folder holding it, so a repo-managed folder cannot end up with unmanaged or
// foreign-managed children.
func CheckSameRepoManager(folder, resource GrafanaMetaAccessor) error {
	folderManager, ok := folder.GetManagerProperties()
	if !ok || folderManager.Kind != ManagerKindRepo {
		return nil
	}

	resourceManager, resourceManaged := resource.GetManagerProperties()
	if !resourceManaged {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: fmt.Sprintf("folder is managed by %s:%s, but the resource is not managed", folderManager.Kind, folderManager.Identity),
		}}
	}

	if resourceManager.Kind != folderManager.Kind || resourceManager.Identity != folderManager.Identity {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure,
			Code:   http.StatusForbidden,
			Reason: metav1.StatusReasonForbidden,
			Message: fmt.Sprintf("resource manager (%s:%s) does not match folder manager (%s:%s); resources must be managed by the same manager as their containing folder",
				resourceManager.Kind, resourceManager.Identity,
				folderManager.Kind, folderManager.Identity),
		}}
	}

	return nil
}

// CheckClassicFPAssignment blocks assigning classic-file-provisioning provenance. The
// manager annotations are server-derived and only the file provisioner may set them.
func CheckClassicFPAssignment(auth authtypes.AuthInfo, obj GrafanaMetaAccessor) error {
	kind := ParseManagerKindString(obj.GetAnnotation(AnnoKeyManagerKind))
	if kind != ManagerKindClassicFP { // nolint:staticcheck
		return nil
	}
	if identity.IsServiceIdentityAuth(auth) {
		return nil // the file provisioner
	}
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: "Can not set the classic-file-provisioning resource manager",
	}}
}

func CheckManagerWriteAuthz(auth authtypes.AuthInfo, obj GrafanaMetaAccessor) error {
	kind := obj.GetAnnotation(AnnoKeyManagerKind)
	if kind == "" {
		return nil
	}

	switch ParseManagerKindString(kind) {
	case ManagerKindUnknown:
		return nil // not managed

	case ManagerKindRepo:
		if identity.IsProvisioningServiceIdentity(auth) {
			return nil // OK!
		}
		// This can fallback to writing the value with a provisioning client
		return ErrResourceIsManagedInRepository

	case ManagerKindFileProvisioning,
		ManagerKindPlugin,
		ManagerKindClassicFP,                  // nolint:staticcheck
		ManagerKindClassicAPI,                 // nolint:staticcheck
		ManagerKindClassicConvertedPrometheus: // nolint:staticcheck
		// ?? what identity do we use for legacy internal requests?
		return nil // no error

	case ManagerKindTerraform, ManagerKindKubectl:
		manager, _ := obj.GetManagerProperties()
		if manager.AllowsEdits {
			return nil // no error anyone can do it
		}
		// TODO: check the kubectl+terraform resource
		return nil

	case ManagerKindGrafana:
		// Used for global role management.
		return nil // Let the api admission hooks handle it
	}
	return nil
}

// CheckManagerOnDelete refuses deleting a managed resource the caller is not
// entitled to delete.
func CheckManagerOnDelete(auth authtypes.AuthInfo, obj GrafanaMetaAccessor) error {
	return CheckManagerWriteAuthz(auth, obj)
}

// CheckManagerOnCreate refuses creating a resource with manager annotations the
// caller may not assign.
func CheckManagerOnCreate(auth authtypes.AuthInfo, obj GrafanaMetaAccessor) error {
	if err := CheckClassicFPAssignment(auth, obj); err != nil {
		return err
	}
	return CheckManagerWriteAuthz(auth, obj)
}

// CheckManagerOnUpdate refuses a spec update that changes the manager in a way the
// annotations do not allow, or that the caller is not entitled to make. Adding,
// rewriting and removing a manager are each gated differently, so this needs both
// the proposed and the stored object.
func CheckManagerOnUpdate(auth authtypes.AuthInfo, obj, old GrafanaMetaAccessor) error {
	managerNew, hasNew := obj.GetManagerProperties()
	managerOld, hasOld := old.GetManagerProperties()

	if !hasNew && !hasOld {
		return nil // neither old nor new are managed
	}

	// Removing a manager: the caller must be authorized for the *old* manager.
	if !hasNew && hasOld {
		if err := CheckManagerWriteAuthz(auth, old); err != nil {
			// Allow admins to release repo-managed resources. There is no
			// reconciliation loop that automatically releases orphaned
			// resources, so admins need the ability to detach manually.
			if errors.Is(err, ErrResourceIsManagedInRepository) {
				if requester, ok := auth.(identity.Requester); ok &&
					(requester.GetIsGrafanaAdmin() || requester.HasRole(identity.RoleAdmin)) {
					return nil
				}
			}
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Can not remove resource manager from resource",
			}}
		}
		return nil
	}

	if err := CheckManagerPropertiesOnUpdate(managerOld, managerNew, hasOld, hasNew); err != nil {
		return err
	}

	// Adding a manager or updating flags on the same owner. Gate only a *new* classic-FP
	// assignment: rewriting one that already carries it must keep working (allowUiUpdates).
	if !hasOld || managerOld.Kind != ManagerKindClassicFP { // nolint:staticcheck
		if err := CheckClassicFPAssignment(auth, obj); err != nil {
			return err
		}
	}
	return CheckManagerWriteAuthz(auth, obj)
}
