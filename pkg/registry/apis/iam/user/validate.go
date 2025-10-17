package user

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ValidateOnCreate(ctx context.Context, userSearchClient resourcepb.ResourceIndexClient, obj *iamv0alpha1.User) error {
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

	if err := validateRole(obj); err != nil {
		return err
	}

	if err := validateEmail(ctx, userSearchClient, requester.GetNamespace(), obj.Spec.Email); err != nil {
		return err
	}

	if err := validateLogin(ctx, userSearchClient, requester.GetNamespace(), obj.Spec.Login); err != nil {
		return err
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, userSearchClient resourcepb.ResourceIndexClient, oldObj, newObj *iamv0alpha1.User) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	isGrafanaAdmin := requester.GetIsGrafanaAdmin()
	isServiceUser := requester.IsIdentityType(types.TypeAccessPolicy)

	if !isGrafanaAdmin {
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

	if !newObj.Spec.Provisioned && oldObj.Spec.Provisioned {
		return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
			newObj.Name,
			fmt.Errorf("provisioned user cannot be un-provisioned"))
	}

	if !isServiceUser {
		if newObj.Spec.Provisioned && !oldObj.Spec.Provisioned {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only service users can provision a user"))
		}
		if newObj.Spec.EmailVerified && !oldObj.Spec.EmailVerified {
			return apierrors.NewForbidden(iamv0alpha1.UserResourceInfo.GroupResource(),
				newObj.Name,
				fmt.Errorf("only service users can verify email"))
		}
	}

	if newObj.Spec.Login == "" && newObj.Spec.Email == "" {
		return apierrors.NewBadRequest("user must have either login or email")
	}

	if err := validateRole(newObj); err != nil {
		return err
	}

	if newObj.Spec.Email != oldObj.Spec.Email {
		if err := validateEmail(ctx, userSearchClient, requester.GetNamespace(), newObj.Spec.Email); err != nil {
			return err
		}
	}

	if newObj.Spec.Login != oldObj.Spec.Login {
		if err := validateLogin(ctx, userSearchClient, requester.GetNamespace(), newObj.Spec.Login); err != nil {
			return err
		}
	}

	return nil
}

func validateRole(obj *iamv0alpha1.User) error {
	if obj.Spec.Role == "" {
		return apierrors.NewBadRequest("role is required")
	}

	if !identity.RoleType(obj.Spec.Role).IsValid() {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid role '%s'", obj.Spec.Role))
	}

	return nil
}

func validateEmail(ctx context.Context, searchClient resourcepb.ResourceIndexClient, namespace, email string) error {
	req := createUserSearchRequest(namespace, []*resourcepb.Requirement{
		{
			Key:      "fields.email",
			Operator: string(selection.Equals),
			Values:   []string{email},
		},
	})

	resp, err := searchClient.Search(ctx, req)
	if err != nil {
		return err
	}

	if resp.TotalHits > 0 {
		return apierrors.NewConflict(iamv0alpha1.UserResourceInfo.GroupResource(),
			fmt.Sprintf("%s", namespace),
			fmt.Errorf("email '%s' is already taken", email))
	}

	return nil
}

func validateLogin(ctx context.Context, searchClient resourcepb.ResourceIndexClient, namespace, login string) error {
	req := createUserSearchRequest(namespace, []*resourcepb.Requirement{
		{
			Key:      "login",
			Operator: string(selection.Equals),
			Values:   []string{login},
		},
	})
	resp, err := searchClient.Search(ctx, req)
	if err != nil {
		return err
	}

	if resp.TotalHits > 0 {
		return apierrors.NewConflict(iamv0alpha1.UserResourceInfo.GroupResource(),
			fmt.Sprintf("%s", namespace, login),
			fmt.Errorf("login '%s' is already taken", login))
	}

	return nil
}

func createUserSearchRequest(namespace string, requirements []*resourcepb.Requirement) *resourcepb.ResourceSearchRequest {
	userGvr := iamv0alpha1.UserResourceInfo.GroupResource()
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     userGvr.Group,
				Resource:  userGvr.Resource,
				Namespace: namespace,
			},
			Fields: requirements,
		},
	}
}
