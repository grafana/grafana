package resourcepermission

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func ValidateCreateAndUpdateInput(ctx context.Context, v0ResourcePerm *v0alpha1.ResourcePermission, mappers *MappersRegistry) error {
	if v0ResourcePerm == nil {
		return apierrors.NewBadRequest("resource permission cannot be nil")
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return apierrors.NewBadRequest(fmt.Sprintf("resource permission must have at least one permission: %s", errInvalidSpec))
	}

	grn, err := splitResourceName(v0ResourcePerm.Name)
	if err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid resource permission name: %s", err))
	}

	if grn.Name == "*" {
		return apierrors.NewBadRequest(`resource name "*" is not valid: resource permissions must target a specific resource`)
	}

	// Validate that the group/resource/name in the name matches the spec
	if grn.Group != v0ResourcePerm.Spec.Resource.ApiGroup ||
		grn.Resource != v0ResourcePerm.Spec.Resource.Resource ||
		grn.Name != v0ResourcePerm.Spec.Resource.Name {
		return apierrors.NewBadRequest(fmt.Sprintf("resource permission name does not match spec: %s", errInvalidSpec))
	}

	// Check that the group/resource is registered and enabled
	groupResource := schema.GroupResource{Group: grn.Group, Resource: grn.Resource}
	if !mappers.IsEnabled(groupResource) {
		return apierrors.NewBadRequest(fmt.Sprintf("unknown or disabled group/resource %s/%s", grn.Group, grn.Resource))
	}

	mapper, ok := mappers.Get(groupResource)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("mapper not found for group/resource %s/%s", grn.Group, grn.Resource))
	}

	// Check for duplicate entities and validate kind/verb per permission
	seen := make(map[string]bool)
	for _, perm := range v0ResourcePerm.Spec.Permissions {
		if !mapper.AllowsKind(perm.Kind) {
			return apierrors.NewBadRequest(fmt.Sprintf("assignment kind %q is not allowed for resource %q: %s", perm.Kind, grn.Resource, errInvalidSpec))
		}
		if _, err := mapper.ActionSet(perm.Verb); err != nil {
			return apierrors.NewBadRequest(fmt.Sprintf("verb %q is not valid for resource %q: %s", perm.Verb, grn.Resource, errInvalidSpec))
		}
		key := fmt.Sprintf("%s:%s", perm.Kind, perm.Name)
		if seen[key] {
			return apierrors.NewBadRequest(fmt.Sprintf("duplicate entity found: kind=%s, name=%s (each entity can only appear once per resource): %s", perm.Kind, perm.Name, errInvalidSpec))
		}
		seen[key] = true
	}

	return nil
}

// ValidateDeleteInput validates a resource permission delete operation.
// It ensures the resource being deleted has a known/registered group/resource type.
// This prevents deletes of resource permissions for resource types that aren't
// enabled or registered in the system.
func ValidateDeleteInput(ctx context.Context, name string, mappers *MappersRegistry) error {
	grn, err := splitResourceName(name)
	if err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid resource permission name: %s", err))
	}

	if grn.Name == "*" {
		return apierrors.NewBadRequest(`resource name "*" is not valid: resource permissions must target a specific resource`)
	}

	// Check that the group/resource is registered and enabled
	if !mappers.IsEnabled(schema.GroupResource{Group: grn.Group, Resource: grn.Resource}) {
		return apierrors.NewBadRequest(fmt.Sprintf("unknown or disabled group/resource %s/%s", grn.Group, grn.Resource))
	}

	return nil
}
