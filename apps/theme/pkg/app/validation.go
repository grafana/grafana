package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	themeV0alpha1 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
)

var _ simple.KindValidator = NewValidator()

// Validator implements simple.KindValidator for Theme resources.
// For user themes (name prefixed with "{userID}."), it enforces ownership:
// non-admin users can only manage their own themes.
type Validator struct{}

func NewValidator() *Validator {
	return &Validator{}
}

// adminGroups are the groups that bypass the userID ownership check.
var adminGroups = []string{"grafana:admin"}

func (v *Validator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	var obj *themeV0alpha1.Theme
	if req.Object != nil {
		var ok bool
		obj, ok = req.Object.(*themeV0alpha1.Theme)
		if !ok {
			return errors.New("unexpected object type")
		}
	} else if req.OldObject != nil {
		var ok bool
		obj, ok = req.OldObject.(*themeV0alpha1.Theme)
		if !ok {
			return errors.New("unexpected old object type")
		}
	} else {
		return errors.New("no object in admission request")
	}

	// Check if this is a user theme by looking for a "." in the name
	dotIndex := strings.IndexByte(obj.Name, '.')
	if dotIndex < 0 {
		// Global/org theme — no ownership check needed
		return nil
	}

	// User theme: extract the user ID prefix
	userID := obj.Name[:dotIndex]

	// Admins can manage any user's themes
	for _, group := range req.UserInfo.Groups {
		if slices.Contains(adminGroups, group) {
			return nil
		}
	}

	// Non-admins can only manage their own themes
	specUserID := "user:" + userID
	if specUserID != req.UserInfo.UID {
		return fmt.Errorf("you can only manage your own themes (theme owner: %s, your ID: %s)", specUserID, req.UserInfo.UID)
	}

	return nil
}
