package theme

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	themeV0alpha1 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

var _ storewrapper.ResourceStorageAuthorizer = (*UserThemeStorageAuthorizer)(nil)

var userThemeGroupResource = schema.GroupResource{
	Group:    themeV0alpha1.GroupVersion.Group,
	Resource: "userthemes",
}

// adminGroups are the groups that bypass the userID ownership check.
var storageAdminGroups = []string{"grafana:admin"}

type UserThemeStorageAuthorizer struct{}

func NewUserThemeStorageAuthorizer() *UserThemeStorageAuthorizer {
	return &UserThemeStorageAuthorizer{}
}

func isAdmin(authInfo types.AuthInfo) bool {
	for _, group := range authInfo.GetGroups() {
		if slices.Contains(storageAdminGroups, group) {
			return true
		}
	}
	return false
}

func (a *UserThemeStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	if isAdmin(authInfo) {
		return nil
	}

	ut, ok := obj.(*themeV0alpha1.UserTheme)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected UserTheme, got %T: %w", obj, storewrapper.ErrUnexpectedType))
	}

	if ut.Spec.UserID != authInfo.GetIdentifier() {
		return apierrors.NewForbidden(userThemeGroupResource, ut.Name, fmt.Errorf("access denied"))
	}

	return nil
}

func (a *UserThemeStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	if isAdmin(authInfo) {
		return list, nil
	}

	l, ok := list.(*themeV0alpha1.UserThemeList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected UserThemeList, got %T: %w", list, storewrapper.ErrUnexpectedType))
	}

	var filtered []themeV0alpha1.UserTheme
	for _, item := range l.Items {
		if item.Spec.UserID == authInfo.GetIdentifier() {
			filtered = append(filtered, item)
		}
	}

	l.Items = filtered
	return l, nil
}

// Write operations defer to admission validation.
func (a *UserThemeStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (a *UserThemeStorageAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (a *UserThemeStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return nil
}
