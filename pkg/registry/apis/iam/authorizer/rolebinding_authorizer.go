package authorizer

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// RoleBindingAuthorizer checks that when a user creates/updates a RoleBinding, the user
// holds every permission in each referenced role (Role, CoreRole, or GlobalRole).
type RoleBindingAuthorizer struct {
	validator *RolePermissionValidator
	resolver  RoleRefResolver
}

var _ storewrapper.ResourceStorageAuthorizer = (*RoleBindingAuthorizer)(nil)

// NewRoleBindingAuthorizer creates a RoleBindingAuthorizer that validates all role refs.
func NewRoleBindingAuthorizer(validator *RolePermissionValidator, resolver RoleRefResolver) *RoleBindingAuthorizer {
	return &RoleBindingAuthorizer{validator: validator, resolver: resolver}
}

// reads & deletes do not need special authorization
func (a *RoleBindingAuthorizer) AfterGet(_ context.Context, _ runtime.Object) error { return nil }
func (a *RoleBindingAuthorizer) FilterList(_ context.Context, list runtime.Object) (runtime.Object, error) {
	return list, nil
}
func (a *RoleBindingAuthorizer) BeforeDelete(_ context.Context, _ runtime.Object) error { return nil }

// creates & updates need to check the role permissions
func (a *RoleBindingAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return a.beforeWrite(ctx, obj)
}

func (a *RoleBindingAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	return a.beforeWrite(ctx, obj)
}

func (a *RoleBindingAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	rb, err := extractRoleBinding(obj)
	if err != nil {
		return err
	}

	for _, ref := range rb.Spec.RoleRefs {
		perms, err := a.resolver.GetPermissionsForRef(ctx, string(ref.Kind), ref.Name)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return apierrors.NewBadRequest(
					fmt.Sprintf("role not found: %s", ref.Name),
				)
			}
			return err
		}
		if err := a.validator.ValidateUserCanDelegatePermissions(ctx, perms); err != nil {
			return apierrors.NewForbidden(
				iamv0.RoleBindingInfo.GroupResource(),
				rb.Name,
				err,
			)
		}
	}
	return nil
}

// DenyCustomRoleRefsAuthorizer rejects any RoleBinding that reference a role, because the role api is disabled, therefore we cannot check
type DenyCustomRoleRefsAuthorizer struct{}

var _ storewrapper.ResourceStorageAuthorizer = (*DenyCustomRoleRefsAuthorizer)(nil)

func NewDenyCustomRoleRefsAuthorizer() *DenyCustomRoleRefsAuthorizer {
	return &DenyCustomRoleRefsAuthorizer{}
}

func (d *DenyCustomRoleRefsAuthorizer) AfterGet(_ context.Context, _ runtime.Object) error {
	return nil
}
func (d *DenyCustomRoleRefsAuthorizer) FilterList(_ context.Context, list runtime.Object) (runtime.Object, error) {
	return list, nil
}
func (d *DenyCustomRoleRefsAuthorizer) BeforeDelete(_ context.Context, _ runtime.Object) error {
	return nil
}

func (d *DenyCustomRoleRefsAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return d.beforeWrite(ctx, obj)
}

func (d *DenyCustomRoleRefsAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	return d.beforeWrite(ctx, obj)
}

func (d *DenyCustomRoleRefsAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	rb, err := extractRoleBinding(obj)
	if err != nil {
		return err
	}

	for _, ref := range rb.Spec.RoleRefs {
		if ref.Kind == iamv0.RoleBindingSpecRoleRefKindRole {
			return apierrors.NewForbidden(
				iamv0.RoleBindingInfo.GroupResource(),
				rb.Name,
				fmt.Errorf("binding to roles is not supported in this mode"),
			)
		}
	}
	return nil
}

func extractRoleBinding(obj runtime.Object) (*iamv0.RoleBinding, error) {
	rb, ok := obj.(*iamv0.RoleBinding)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected RoleBinding, got %T: %w", obj, storewrapper.ErrUnexpectedType))
	}
	return rb, nil
}
