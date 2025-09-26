package resources

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

type ResourcePermissionsClient struct {
	permissionClient *dynamic.ResourceInterface
}

// NewResourcePermissionsClient creates a new ResourcePermissionsClient that is responsible for creating default resource permissions for root level resources
func NewResourcePermissionsClient(permissionClient *dynamic.ResourceInterface) ResourcePermissionsClient {
	return ResourcePermissionsClient{permissionClient}
}

var defaultPermissions = []map[string]any{
	{
		"kind": "BasicRole",
		"name": "Admin",
		"verb": "admin",
	},
	{
		"kind": "BasicRole",
		"name": "Editor",
		"verb": "edit",
	},
	{
		"kind": "BasicRole",
		"name": "Viewer",
		"verb": "view",
	},
}

// createRootPermissions creates default resource permissions for root level resources. note: it will overwrite any existing permissions
// so this should only ever be called on _create_ of a resource, not on update so we do not overwrite something that has been updated by the user.
func (r ResourcePermissionsClient) createRootPermissions(ctx context.Context, gvr schema.GroupVersionResource, id, namespace string) error {
	// fail gracefully if this is not available. kubernetesAuthzResourcePermissionApis needs to be enabled to use resource permissions
	// and when running in one binary, default permissions are already being created
	if r.permissionClient == nil {
		return nil
	}

	client := *r.permissionClient
	name := fmt.Sprintf("%s-%s-%s", gvr.Group, gvr.Resource, id)

	// the resource permission will likely already exist with admin can admin, so we will need to update it
	if _, err := client.Get(ctx, name, metav1.GetOptions{}); err == nil {
		_, err := client.Update(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      name,
					"namespace": namespace,
				},
				"spec": map[string]any{
					"resource": map[string]any{
						"apiGroup": gvr.Group,
						"resource": gvr.Resource,
						"name":     id,
					},
					"permissions": defaultPermissions,
				},
			},
		}, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("update root permissions: %w", err)
		}

		return nil
	}

	_, err := client.Create(ctx, &unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]any{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]any{
				"resource": map[string]any{
					"apiGroup": gvr.Group,
					"resource": gvr.Resource,
					"name":     id,
				},
				"permissions": defaultPermissions,
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("create root permissions: %w", err)
	}

	return nil
}
