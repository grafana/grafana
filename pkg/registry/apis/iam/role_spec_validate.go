package iam

import (
	"fmt"
	"strings"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// Global roles cannot reference other roles or omit permissions
func ValidateGlobalRoleSpec(gr *iamv0.GlobalRole) error {
	if len(gr.Spec.RoleRefs) > 0 {
		return fmt.Errorf("global roles cannot have roleRefs defined")
	}
	if len(gr.Spec.PermissionsOmitted) > 0 {
		return fmt.Errorf("global roles cannot have permissionsOmitted defined")
	}
	return nil
}

// Role refs may only reference a basic global role
func ValidateRoleSpec(r *iamv0.Role) error {
	for _, ref := range r.Spec.RoleRefs {
		if ref.Kind != string(iamv0.RoleBindingSpecRoleRefKindGlobalRole) {
			return fmt.Errorf("role refs may only reference a global basic role (kind must be GlobalRole), got kind %q", ref.Kind)
		}
		if !strings.HasPrefix(ref.Name, "basic_") {
			return fmt.Errorf("role refs may only reference a global basic role, got name %q", ref.Name)
		}
	}
	return nil
}
