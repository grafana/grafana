package user

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.User) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	// Temporary validation that the user is not trying to create a Grafana Admin without being a Grafana Admin.
	if obj.Spec.GrafanaAdmin && !requester.GetIsGrafanaAdmin() {
		return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
			obj.Name,
			fmt.Errorf("only grafana admins can create grafana admins"))
	}

	if obj.Spec.Login == "" && obj.Spec.Email == "" {
		return apierrors.NewBadRequest("user must have either login or email")
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, oldObj, newObj *iamv0alpha1.User) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	isGrafanaAdmin := requester.GetIsGrafanaAdmin()
	isServiceUser := requester.IsIdentityType(types.TypeAccessPolicy)

	if !isGrafanaAdmin {
		if newObj.Spec.Email != oldObj.Spec.Email || newObj.Spec.Name != oldObj.Spec.Name || newObj.Spec.Login != oldObj.Spec.Login {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only grafana admins can update email, name, or login"))
		}
		if newObj.Spec.Disabled != oldObj.Spec.Disabled {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only grafana admins can disable or enable a user"))
		}
		if newObj.Spec.GrafanaAdmin != oldObj.Spec.GrafanaAdmin {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only grafana admins can change grafana admin status"))
		}
	}

	if !isServiceUser {
		if newObj.Spec.Provisioned != oldObj.Spec.Provisioned {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only service users can update provisioned status"))
		}
		if newObj.Spec.EmailVerified && !oldObj.Spec.EmailVerified {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only service users can verify email"))
		}
	}

	return nil
}
