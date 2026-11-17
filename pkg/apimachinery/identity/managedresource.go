package identity

// Manager-annotation authorization: whether a caller may write a resource that
// carries grafana.app/managedBy and friends.
//
// This lives here rather than in a package of its own because pkg/apimachinery is a
// separately versioned module that other workspace modules consume by published
// version, so a new package under it is not importable until that module is
// released. It is not in apimachinery/utils, which owns the annotations and the
// storage-independent rules about them, because answering this needs the caller's
// identity and so reaches github.com/grafana/authlib -- and utils is imported by
// nearly every resource conversion in the tree.

import (
	"errors"
	"net/http"

	"github.com/grafana/authlib/authn"
	authtypes "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ErrResourceIsManagedInRepository reports that a write targets a repo-managed
// resource. Unified storage re-routes such a write to the provisioning files
// endpoint; storage that cannot route it should turn this into a 403.
var ErrResourceIsManagedInRepository = errors.New("this resource is managed by a repository")

// CheckClassicFPAssignment blocks assigning classic-file-provisioning provenance. The
// manager annotations are server-derived and only the file provisioner may set them.
func CheckClassicFPAssignment(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	kind := utils.ParseManagerKindString(obj.GetAnnotation(utils.AnnoKeyManagerKind))
	if kind != utils.ManagerKindClassicFP { // nolint:staticcheck
		return nil
	}
	if IsServiceIdentityAuth(auth) {
		return nil // the file provisioner
	}
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: "Can not set the classic-file-provisioning resource manager",
	}}
}

// isGrafanaCloudServiceIdentity reports whether auth carries exactly one serviceIdentity claim and
// it matches grafanaCloudServiceIdentity.
func isGrafanaCloudServiceIdentity(auth authtypes.AuthInfo, grafanaCloudServiceIdentity string) bool {
	if auth == nil || grafanaCloudServiceIdentity == "" {
		return false
	}
	ids := auth.GetExtra()[authn.ServiceIdentityKey]
	return len(ids) == 1 && ids[0] == grafanaCloudServiceIdentity
}

func CheckManagerWriteAuthz(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, grafanaCloudServiceIdentity string) error {
	kind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	if kind == "" {
		return nil
	}

	switch utils.ParseManagerKindString(kind) {
	case utils.ManagerKindUnknown:
		return nil // not managed

	case utils.ManagerKindRepo:
		if IsProvisioningServiceIdentity(auth) {
			return nil // OK!
		}
		// This can fallback to writing the value with a provisioning client
		return ErrResourceIsManagedInRepository

	case utils.ManagerKindFileProvisioning,
		utils.ManagerKindPlugin,
		utils.ManagerKindClassicFP,                  // nolint:staticcheck
		utils.ManagerKindClassicAPI,                 // nolint:staticcheck
		utils.ManagerKindClassicConvertedPrometheus: // nolint:staticcheck
		// ?? what identity do we use for legacy internal requests?
		return nil // no error

	case utils.ManagerKindTerraform, utils.ManagerKindKubectl:
		manager, _ := obj.GetManagerProperties()
		if manager.AllowsEdits {
			return nil // no error anyone can do it
		}
		// TODO: check the kubectl+terraform resource
		return nil

	case utils.ManagerKindGrafana:
		// Used for global role management.
		return nil // Let the api admission hooks handle it

	case utils.ManagerKindGrafanaCloud:
		if isGrafanaCloudServiceIdentity(auth, grafanaCloudServiceIdentity) {
			return nil
		}

		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "This resource is managed by Grafana Cloud and can not be changed",
		}}
	}
	return nil
}

// CheckManagerOnDelete refuses deleting a managed resource the caller is not
// entitled to delete.
func CheckManagerOnDelete(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, grafanaCloudServiceIdentity string) error {
	return CheckManagerWriteAuthz(auth, obj, grafanaCloudServiceIdentity)
}

// CheckManagerOnCreate refuses creating a resource with manager annotations the
// caller may not assign.
func CheckManagerOnCreate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, grafanaCloudServiceIdentity string) error {
	if err := CheckClassicFPAssignment(auth, obj); err != nil {
		return err
	}
	return CheckManagerWriteAuthz(auth, obj, grafanaCloudServiceIdentity)
}

// CheckManagerOnUpdate refuses a spec update that changes the manager in a way the
// annotations do not allow, or that the caller is not entitled to make. Adding,
// rewriting and removing a manager are each gated differently, so this needs both
// the proposed and the stored object.
func CheckManagerOnUpdate(auth authtypes.AuthInfo, obj, old utils.GrafanaMetaAccessor, grafanaCloudServiceIdentity string) error {
	managerNew, hasNew := obj.GetManagerProperties()
	managerOld, hasOld := old.GetManagerProperties()

	if !hasNew && !hasOld {
		return nil // neither old nor new are managed
	}

	// Removing a manager: the caller must be authorized for the *old* manager.
	if !hasNew && hasOld {
		if err := CheckManagerWriteAuthz(auth, old, grafanaCloudServiceIdentity); err != nil {
			// Allow admins to release repo-managed resources. There is no
			// reconciliation loop that automatically releases orphaned
			// resources, so admins need the ability to detach manually.
			if errors.Is(err, ErrResourceIsManagedInRepository) {
				if requester, ok := auth.(Requester); ok &&
					(requester.GetIsGrafanaAdmin() || requester.HasRole(RoleAdmin)) {
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

	if err := utils.CheckManagerPropertiesOnUpdate(managerOld, managerNew, hasOld, hasNew); err != nil {
		return err
	}

	// Adding a manager or updating flags on the same owner. Gate only a *new* classic-FP
	// assignment: rewriting one that already carries it must keep working (allowUiUpdates).
	if !hasOld || managerOld.Kind != utils.ManagerKindClassicFP { // nolint:staticcheck
		if err := CheckClassicFPAssignment(auth, obj); err != nil {
			return err
		}
	}
	return CheckManagerWriteAuthz(auth, obj, grafanaCloudServiceIdentity)
}
