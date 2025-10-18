package resourcepermission

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func ValidateCreateAndUpdateInput(ctx context.Context, v0ResourcePerm *v0alpha1.ResourcePermission) error {
	if v0ResourcePerm == nil {
		return fmt.Errorf("resource permission cannot be nil")
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return fmt.Errorf("resource permission must have at least one permission: %w", errInvalidSpec)
	}

	grn, err := splitResourceName(v0ResourcePerm.Name)
	if err != nil {
		return fmt.Errorf("invalid resource permission name: %w", err)
	}

	// Validate that the group/resource/name in the name matches the spec
	if grn.Group != v0ResourcePerm.Spec.Resource.ApiGroup ||
		grn.Resource != v0ResourcePerm.Spec.Resource.Resource ||
		grn.Name != v0ResourcePerm.Spec.Resource.Name {
		return fmt.Errorf("resource permission name does not match spec: %w", errInvalidSpec)
	}

	// Check for duplicate entities (same kind and name should appear only once)
	seen := make(map[string]bool)
	for _, perm := range v0ResourcePerm.Spec.Permissions {
		key := fmt.Sprintf("%s:%s", perm.Kind, perm.Name)
		if seen[key] {
			return fmt.Errorf("duplicate entity found: kind=%s, name=%s (each entity can only appear once per resource): %w", perm.Kind, perm.Name, errInvalidSpec)
		}
		seen[key] = true
	}

	return nil
}
