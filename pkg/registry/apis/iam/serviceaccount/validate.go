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
		return apierrors.NewBadRequest("no identity found")
	}

	requestedRole := identity.RoleType(obj.Spec.Role)
	if !requestedRole.IsValid() {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid role: %s", requestedRole))
	}

	if obj.Spec.Plugin != "" {
		if !strings.HasPrefix(obj.Spec.Title, serviceaccounts.ExtSvcPrefix) {
			return apierrors.NewBadRequest("title of external service accounts must start with " + serviceaccounts.ExtSvcPrefix)
		}

		if !strings.HasSuffix(obj.Spec.Title, strings.ToLower(obj.Spec.Plugin)) {
			return apierrors.NewBadRequest("title of external service accounts must end with " + strings.ToLower(obj.Spec.Plugin))
		}

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
			fmt.Errorf("can not assign a role higher than user's role"))
	}

	return nil
}
