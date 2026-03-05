package app

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	themeV0alpha1 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
)

var _ simple.KindValidator = NewValidator()

// Validator implements simple.KindValidator for Theme resources.
type Validator struct{}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	return nil
}

var _ simple.KindValidator = NewUserThemeValidator()

// UserThemeValidator enforces that non-admin users can only manage UserThemes scoped to their own user ID.
type UserThemeValidator struct{}

func NewUserThemeValidator() *UserThemeValidator {
	return &UserThemeValidator{}
}

// adminGroups are the groups that bypass the userID ownership check.
var adminGroups = []string{"grafana:admin"}

func (v *UserThemeValidator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	// On DELETE, the object being deleted is in OldObject (Object may be nil)
	var obj *themeV0alpha1.UserTheme
	if req.Object != nil {
		var ok bool
		obj, ok = req.Object.(*themeV0alpha1.UserTheme)
		if !ok {
			return errors.New("unexpected object type")
		}
	} else if req.OldObject != nil {
		var ok bool
		obj, ok = req.OldObject.(*themeV0alpha1.UserTheme)
		if !ok {
			return errors.New("unexpected old object type")
		}
	} else {
		return errors.New("no object in admission request")
	}

	if obj.Spec.UserID == "" {
		return errors.New("spec.userID is required")
	}

	// Admins can manage any user's themes
	for _, group := range req.UserInfo.Groups {
		if slices.Contains(adminGroups, group) {
			return nil
		}
	}

	specUserID := "user:" + obj.Spec.UserID
	// Non-admins can only manage their own themes
	if specUserID != req.UserInfo.UID {
		return fmt.Errorf("spec.userID (%s) must match your user ID (%s)", specUserID, req.UserInfo.UID)
	}

	return nil
}
