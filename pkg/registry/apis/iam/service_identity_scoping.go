package iam

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// Keep in sync with pkg/services/accesscontrol/pluginutils/utils.go
// Apps/plugins can only grant a small allowlist of core actions, and only when those actions are
// scoped to the app/plugin itself.
var allowedCoreActions = map[string]string{
	"plugins:write":             "plugins:id:",
	"plugins.app:access":        "plugins:id:",
	"folders:create":            "folders:uid:",
	"folders:read":              "folders:uid:",
	"folders:write":             "folders:uid:",
	"folders:delete":            "folders:uid:",
	"folders.permissions:read":  "folders:uid:",
	"folders.permissions:write": "folders:uid:",
}

func serviceIdentityFromContext(ctx context.Context) (serviceIdentity string, present bool, err error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return "", false, nil
	}

	serviceIdentityList, ok := authInfo.GetExtra()[authn.ServiceIdentityKey]
	if !ok || len(serviceIdentityList) == 0 {
		return "", false, nil
	}

	// If there's more than one service identity, something is suspicious and we reject it.
	if len(serviceIdentityList) != 1 {
		return "", true, fmt.Errorf("more than one service identity in token")
	}

	serviceIdentity = strings.TrimSpace(serviceIdentityList[0])
	if serviceIdentity == "" {
		return "", true, fmt.Errorf("empty service identity in token")
	}

	return serviceIdentity, true, nil
}

// extractCoreRoleTargetServiceIdentity returns the service identity targeted by a core role UID.
// This is based on naming conventions used for core roles:
// - plugins_<serviceIdentity>.<suffix>
// - plugins_<serviceIdentity>
// - extsvc_<serviceIdentity>_<suffix>
// - extsvc_<serviceIdentity>
func extractCoreRoleTargetServiceIdentity(coreRoleName string) (prefix string, target string, ok bool) {
	switch {
	case strings.HasPrefix(coreRoleName, "plugins_"):
		rest := strings.TrimPrefix(coreRoleName, "plugins_")
		if rest == "" {
			return "plugins", "", false
		}
		return "plugins", splitOnFirstDelimiter(rest, '.', '_'), true
	case strings.HasPrefix(coreRoleName, "extsvc_"):
		rest := strings.TrimPrefix(coreRoleName, "extsvc_")
		if rest == "" {
			return "extsvc", "", false
		}
		// extsvc roles typically use '_' to separate the service identity from the suffix.
		return "extsvc", splitOnFirstDelimiter(rest, '_', '.'), true
	case strings.HasPrefix(coreRoleName, "fixed_"):
		return "fixed", "", true
	default:
		return "", "", false
	}
}

func splitOnFirstDelimiter(s string, delims ...rune) string {
	if s == "" {
		return ""
	}
	cut := len(s)
	for _, d := range delims {
		if idx := strings.IndexRune(s, d); idx >= 0 && idx < cut {
			cut = idx
		}
	}
	return s[:cut]
}

func validateCoreRoleServiceIdentityTarget(ctx context.Context, role *iamv0.CoreRole) error {
	serviceIdentity, present, err := serviceIdentityFromContext(ctx)
	if err != nil {
		return apierrors.NewForbidden(iamv0.CoreRoleInfo.GroupResource(), role.GetName(), err)
	}
	if !present {
		return nil
	}

	prefix, target, ok := extractCoreRoleTargetServiceIdentity(role.GetName())
	if !ok {
		return apierrors.NewForbidden(
			iamv0.CoreRoleInfo.GroupResource(),
			role.GetName(),
			fmt.Errorf("service identity %q is not allowed to create or update core role %q (unrecognized core role naming convention)", serviceIdentity, role.GetName()),
		)
	}

	// TODO: Add exception for seeding fixed roles
	if prefix == "fixed" {
		return apierrors.NewForbidden(
			iamv0.CoreRoleInfo.GroupResource(),
			role.GetName(),
			fmt.Errorf("service identity %q is not allowed to create or update fixed core roles", serviceIdentity),
		)
	}

	if target == "" || target != serviceIdentity {
		return apierrors.NewForbidden(
			iamv0.CoreRoleInfo.GroupResource(),
			role.GetName(),
			fmt.Errorf("service identity %q is not allowed to create or update core role %q which targets %q", serviceIdentity, role.GetName(), target),
		)
	}

	for i := range role.Spec.Permissions {
		if err := validateServiceIdentityPermission(serviceIdentity, &role.Spec.Permissions[i]); err != nil {
			return apierrors.NewForbidden(
				iamv0.CoreRoleInfo.GroupResource(),
				role.GetName(),
				fmt.Errorf("service identity %q is not allowed to create or update core role %q: invalid permission (action=%q scope=%q): %w",
					serviceIdentity, role.GetName(), role.Spec.Permissions[i].Action, role.Spec.Permissions[i].Scope, err),
			)
		}
	}

	return nil
}

func validateServiceIdentityPermission(serviceIdentity string, perm *iamv0.CoreRolespecPermission) error {
	if perm == nil {
		return fmt.Errorf("permission is nil")
	}

	scopePrefix, isCore := allowedCoreActions[perm.Action]
	if isCore {
		expectedScope := scopePrefix + serviceIdentity
		if perm.Scope != expectedScope {
			return fmt.Errorf("core action must target the calling app: expected scope %q", expectedScope)
		}
		// Prevent any unlikely injection / whitespace tricks by normalizing.
		perm.Scope = expectedScope
		return nil
	}

	// Require the action to be namespaced to the calling app.
	if !strings.HasPrefix(perm.Action, serviceIdentity+":") &&
		!strings.HasPrefix(perm.Action, serviceIdentity+".") {
		return fmt.Errorf("action must be prefixed with %q or %q", serviceIdentity+":", serviceIdentity+".")
	}

	return nil
}
