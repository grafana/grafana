package serviceaccount

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.ServiceAccount) error {
	if obj.Spec.Title == "" {
		return apierrors.NewBadRequest("service account must have a title")
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	requestedRole := identity.RoleType(obj.Spec.Role)
	if !requestedRole.IsValid() {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid role: %s", requestedRole))
	}

	if err := validateTitle(obj); err != nil {
		return err
	}

	if obj.Spec.Plugin != "" {
		if !requester.IsIdentityType(types.TypeAccessPolicy) {
			return apierrors.NewForbidden(iamv0alpha1.ServiceAccountResourceInfo.GroupResource(),
				obj.Name,
				fmt.Errorf("only service identities can create external service accounts"))
		}

		if obj.Spec.Role != iamv0alpha1.ServiceAccountOrgRoleNone {
			return apierrors.NewBadRequest("external service accounts must have role None")
		}
	}

	if !requester.HasRole(requestedRole) {
		return apierrors.NewForbidden(iamv0alpha1.ServiceAccountResourceInfo.GroupResource(),
			obj.Name,
			fmt.Errorf("cannot assign a role higher than user's role"))
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, obj, old *iamv0alpha1.ServiceAccount) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}
	if obj.Spec.Title == "" {
		return apierrors.NewBadRequest("service account must have a title")
	}

	requestedRole := identity.RoleType(obj.Spec.Role)
	if !requestedRole.IsValid() {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid role: %s", requestedRole))
	}

	// The plugin owning an external service account is set on creation and defines
	// its login, so it cannot be moved to (or away from) another plugin.
	if obj.Spec.Plugin != old.Spec.Plugin {
		return apierrors.NewBadRequest("plugin of a service account cannot be changed")
	}

	isExternal := strings.HasPrefix(strings.ToLower(old.Spec.Title), serviceaccounts.ExtSvcPrefix)
	if isExternal {
		if obj.Spec.Title != old.Spec.Title {
			return apierrors.NewBadRequest("title of an external service account cannot be changed")
		}
		if !requester.IsIdentityType(types.TypeAccessPolicy) {
			return apierrors.NewForbidden(iamv0alpha1.ServiceAccountResourceInfo.GroupResource(),
				obj.Name,
				fmt.Errorf("only service identities can update external service accounts"))
		}

		if obj.Spec.Role != iamv0alpha1.ServiceAccountOrgRoleNone {
			return apierrors.NewBadRequest("external service accounts must have role None")
		}
	} else if err := validateTitle(obj); err != nil {
		return err
	}

	if obj.Spec.Role != old.Spec.Role && !requester.HasRole(requestedRole) {
		return apierrors.NewForbidden(iamv0alpha1.ServiceAccountResourceInfo.GroupResource(),
			obj.Name,
			fmt.Errorf("cannot assign a role higher than user's role"))
	}

	return nil
}

func validateTitle(obj *iamv0alpha1.ServiceAccount) error {
	if obj.Spec.Plugin != "" {
		return validateExternalTitle(obj)
	}

	protectedPrefix := strings.TrimSuffix(serviceaccounts.ExtSvcPrefix, "-")
	if strings.HasPrefix(strings.ToLower(obj.Spec.Title), protectedPrefix) {
		return apierrors.NewBadRequest("service account title cannot start with protected prefix " + protectedPrefix)
	}

	return nil
}

func validateExternalTitle(obj *iamv0alpha1.ServiceAccount) error {
	if !strings.HasPrefix(obj.Spec.Title, serviceaccounts.ExtSvcPrefix) {
		return apierrors.NewBadRequest("title of external service accounts must start with " + serviceaccounts.ExtSvcPrefix)
	}

	if !strings.HasSuffix(obj.Spec.Title, strings.ToLower(obj.Spec.Plugin)) {
		return apierrors.NewBadRequest("title of external service accounts must end with " + strings.ToLower(obj.Spec.Plugin))
	}

	return nil
}
