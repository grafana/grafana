package theme

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	themeV0alpha1 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

var _ storewrapper.ResourceStorageAuthorizer = (*ThemeStorageAuthorizer)(nil)

var themeGroupResource = schema.GroupResource{
	Group:    themeV0alpha1.GroupVersion.Group,
	Resource: "themes",
}

// storageAdminGroups are the groups that bypass the userID ownership check.
var storageAdminGroups = []string{"grafana:admin"}

type ThemeStorageAuthorizer struct{}

func NewThemeStorageAuthorizer() *ThemeStorageAuthorizer {
	return &ThemeStorageAuthorizer{}
}

func isAdmin(authInfo types.AuthInfo) bool {
	for _, group := range authInfo.GetGroups() {
		if slices.Contains(storageAdminGroups, group) {
			return true
		}
	}
	return false
}

// isUserTheme checks if a theme name has a user ID prefix (contains a ".").
// Returns the user ID prefix if it's a user theme, or empty string for global themes.
func isUserTheme(name string) string {
	dotIndex := strings.IndexByte(name, '.')
	if dotIndex < 0 {
		return ""
	}
	return name[:dotIndex]
}

func (a *ThemeStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	if isAdmin(authInfo) {
		return nil
	}

	t, ok := obj.(*themeV0alpha1.Theme)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected Theme, got %T: %w", obj, storewrapper.ErrUnexpectedType))
	}

	ownerID := isUserTheme(t.Name)
	if ownerID == "" {
		// Global theme — accessible to everyone
		return nil
	}

	// User theme — only the owner can access it
	if ownerID != authInfo.GetIdentifier() {
		return apierrors.NewForbidden(themeGroupResource, t.Name, fmt.Errorf("access denied"))
	}

	return nil
}

func (a *ThemeStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	if isAdmin(authInfo) {
		return list, nil
	}

	l, ok := list.(*themeV0alpha1.ThemeList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected ThemeList, got %T: %w", list, storewrapper.ErrUnexpectedType))
	}

	var filtered []themeV0alpha1.Theme
	for _, item := range l.Items {
		ownerID := isUserTheme(item.Name)
		if ownerID == "" {
			// Global theme — include for everyone
			filtered = append(filtered, item)
		} else if ownerID == authInfo.GetIdentifier() {
			// User's own theme — include
			filtered = append(filtered, item)
		}
		// Other users' themes — skip
	}

	l.Items = filtered
	return l, nil
}

// Write operations defer to admission validation.
func (a *ThemeStorageAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (a *ThemeStorageAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (a *ThemeStorageAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return nil
}
