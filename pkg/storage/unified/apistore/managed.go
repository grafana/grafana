package apistore

import (
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func checkManagerPropertiesOnDelete(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnCreate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnUpdateSpec(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, old utils.GrafanaMetaAccessor) error {
	objKind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	oldKind := old.GetAnnotation(utils.AnnoKeyManagerKind)
	if objKind == "" && objKind == oldKind {
		return nil // not managed
	}

	// Check the current settings
	err := checkManagerPropertiesOnCreate(auth, obj)
	if err != nil { // new settings failed
		return err
	}

	managerNew, okNew := obj.GetManagerProperties()
	managerOld, okOld := old.GetManagerProperties()
	if managerNew == managerOld || (okNew && !okOld) { // added manager is OK
		return nil
	}

	if !okNew && okOld {
		// This allows removing the managedBy annotations if you were allowed to write them originally
		if err := checkManagerPropertiesOnCreate(auth, old); err != nil {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Can not remove resource manager from resource",
			}}
		}
	}
	return nil
}

func enforceManagerProperties(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	kind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	if kind == "" {
		return nil
	}

	switch utils.ParseManagerKindString(kind) {
	case utils.ManagerKindUnknown:
		return nil // not managed

	case utils.ManagerKindRepo:
		if auth.GetUID() == "access-policy:provisioning" {
			return nil // OK!
		}
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "Provisioned resources must be manaaged by the provisioning service account",
		}}

	case utils.ManagerKindPlugin, utils.ManagerKindClassicFP: // nolint:staticcheck
		// ?? what identity do we use for legacy internal requests?
		return nil // no error

	case utils.ManagerKindTerraform, utils.ManagerKindKubectl:
		manager, _ := obj.GetManagerProperties()
		if manager.AllowsEdits {
			return nil // no error anyone can do it
		}
		// TODO: check the kubectl+terraform resource
		return nil
	}
	return nil
}
