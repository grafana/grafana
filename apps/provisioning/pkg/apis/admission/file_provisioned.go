package admission

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ValidateFileProvisionedConfiguration blocks a user's write to a Repository or Connection whose
// own configuration comes from file provisioning: the reconciler replaces that spec on every boot,
// and one that drops the manager annotations stops the reconciler recognising it at all.
//
// The test is who is asking, not who owns the resource: the reconciler writes through the loopback
// client, which carries no provisioning identity, so only a request made by a person -- or by a
// token acting for one -- can be told apart from an in-process write.
func ValidateFileProvisionedConfiguration(ctx context.Context, a admission.Attributes, meta utils.GrafanaMetaAccessor) error {
	if !isUserRequest(ctx) {
		return nil
	}

	manager, managed := meta.GetManagerProperties()

	switch a.GetOperation() {
	case admission.Create:
		if managed && manager.Kind == utils.ManagerKindFileProvisioning {
			return forbidFileProvisioned(a, fmt.Sprintf("%s provenance is set by the instance configuration, not by a request", utils.ManagerKindFileProvisioning))
		}
	case admission.Update:
		old := a.GetOldObject()
		if old == nil {
			return nil
		}
		oldMeta, err := utils.MetaAccessor(old)
		if err != nil {
			return nil
		}
		oldManager, oldManaged := oldMeta.GetManagerProperties()
		if !oldManaged || oldManager.Kind != utils.ManagerKindFileProvisioning {
			return nil
		}
		if !managed || manager != oldManager {
			return forbidFileProvisioned(a, fmt.Sprintf("the %s manager of this configuration cannot be changed", utils.ManagerKindFileProvisioning))
		}
		if SpecAndSecureChanged(a) {
			return forbidFileProvisioned(a, fmt.Sprintf("this configuration is managed by %s; change it where it is defined", utils.ManagerKindFileProvisioning))
		}
	case admission.Delete, admission.Connect:
		// Deleting is how an operator clears configuration that no longer names the resource.
	}

	return nil
}

func forbidFileProvisioned(a admission.Attributes, message string) error {
	return apierrors.NewForbidden(a.GetResource().GroupResource(), a.GetName(), errors.New(message))
}

// isUserRequest reports whether the caller is a person, or a token acting for one.
func isUserRequest(ctx context.Context) bool {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return false
	}
	return requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount, claims.TypeAPIKey)
}
