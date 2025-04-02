package apistore

import (
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func checkManagerPropertiesOnCreate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	manager, ok := obj.GetManagerProperties()
	if !ok {
		return nil
	}

	switch manager.Kind {
	case utils.ManagerKindRepo:
		if "access-policy:provisioning" == auth.GetUID() {
			return nil // OK!
		}
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "Provisioned resources must be manaaged by the provisioing servie account",
		}}
	case utils.ManagerKindPlugin, utils.ManagerKindClassicFP:
		// ?? what identity do we use for legacy internal requests?
		return nil // not right
	}

	// Make sure the request is from
	if !manager.AllowsEdits {
		switch auth.GetIdentityType() {
		case authtypes.TypeAccessPolicy, authtypes.TypeServiceAccount:
			return nil // OK
		}
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "Resource is not configured to allow editing",
		}}
	}

	return nil
}

func checkManagerPropertiesOnUpdate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, old utils.GrafanaMetaAccessor) error {
	managerNew, okNew := obj.GetManagerProperties()
	managerOld, okOld := old.GetManagerProperties()
	if !okNew && okNew == okOld {
		return nil // not managed
	}

	err := checkManagerPropertiesOnCreate(auth, obj)
	if err != nil || managerNew == managerOld { // no change
		return err
	}

	// TODO??? manager properties changed???

	return nil
}
