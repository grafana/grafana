package resourcepermissions

import (
	"context"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

func (a *api) getDynamicClient(ctx context.Context) (dynamic.Interface, error) {
	if a.restConfigProvider == nil {
		return nil, fmt.Errorf("k8s rest config provider not available")
	}

	restConfig, err := a.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get rest config: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return dynamicClient, nil
}

func (a *api) getResourcePermissionsFromK8s(ctx context.Context, namespace string, resourceID string) (getResourcePermissionsResponse, error) {
	dynamicClient, err := a.getDynamicClient(ctx)
	if err != nil {
		return nil, err
	}

	resourcePermName := a.buildResourcePermissionName(resourceID)

	resourcePermResource := dynamicClient.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace)
	resourcePerm, err := resourcePermResource.Get(ctx, resourcePermName, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return getResourcePermissionsResponse{}, nil
		}
		return nil, fmt.Errorf("failed to get resource permission from k8s: %w", err)
	}

	return a.convertK8sResourcePermissionToDTO(resourcePerm)
}

func (a *api) convertK8sResourcePermissionToDTO(resourcePerm *unstructured.Unstructured) (getResourcePermissionsResponse, error) {
	permissions, found, err := unstructured.NestedSlice(resourcePerm.Object, "spec", "permissions")
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions from spec: %w", err)
	}
	if !found {
		return getResourcePermissionsResponse{}, nil
	}

	dto := make(getResourcePermissionsResponse, 0, len(permissions))

	for _, permRaw := range permissions {
		permMap, ok := permRaw.(map[string]interface{})
		if !ok {
			continue
		}

		kind, _, _ := unstructured.NestedString(permMap, "kind")
		name, _, _ := unstructured.NestedString(permMap, "name")
		verb, _, _ := unstructured.NestedString(permMap, "verb")

		if name == "" || verb == "" {
			continue
		}

		actions, exists := a.service.options.PermissionsToActions[verb]
		if !exists {
			log.New("resource-permissions-api").Warn(
				"Permission verb not found in PermissionsToActions map",
				"verb", verb,
				"resource", a.service.options.Resource,
				"availablePermissions", fmt.Sprintf("%v", getMapKeys(a.service.options.PermissionsToActions)),
			)
			actions = []string{}
		}

		permission := verb

		permDTO := resourcePermissionDTO{
			Permission:  permission,
			Actions:     actions,
			IsManaged:   true,
			IsInherited: false,
		}

		switch iamv0.ResourcePermissionSpecPermissionKind(kind) {
		case iamv0.ResourcePermissionSpecPermissionKindUser, iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
			userDetails, err := a.service.userService.GetByUID(context.Background(), &user.GetUserByUIDQuery{UID: name})
			if err == nil {
				permDTO.UserID = userDetails.ID
				permDTO.UserUID = userDetails.UID
				permDTO.UserLogin = userDetails.Login
				permDTO.UserAvatarUrl = dtos.GetGravatarUrl(a.cfg, userDetails.Email)
				permDTO.IsServiceAccount = userDetails.IsServiceAccount
			}
		case iamv0.ResourcePermissionSpecPermissionKindTeam:
			permDTO.TeamUID = name
			permDTO.Team = name
		case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
			permDTO.BuiltInRole = name
		}

		permDTO.RoleName = fmt.Sprintf("managed:%s:%s:permissions", a.service.options.Resource, name)

		dto = append(dto, permDTO)
	}

	return dto, nil
}

func (a *api) getAPIGroup() string {
	switch a.service.options.Resource {
	case "folders":
		return "folder.grafana.app"
	case "dashboards":
		return "dashboard.grafana.app"
	default:
		return fmt.Sprintf("%s.grafana.app", a.service.options.Resource)
	}
}

func getMapKeys(m map[string][]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func (a *api) buildResourcePermissionName(resourceID string) string {
	return fmt.Sprintf("%s-%s-%s", a.getAPIGroup(), a.service.options.Resource, resourceID)
}

// Write operations

func (a *api) setResourcePermissionsToK8s(ctx context.Context, namespace string, resourceID string, permissions []accesscontrol.SetResourcePermissionCommand) error {
	dynamicClient, err := a.getDynamicClient(ctx)
	if err != nil {
		return err
	}

	resourcePermName := a.buildResourcePermissionName(resourceID)
	resourcePermResource := dynamicClient.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace)

	existing, err := resourcePermResource.Get(ctx, resourcePermName, metav1.GetOptions{})
	if err != nil && !k8serrors.IsNotFound(err) {
		return fmt.Errorf("failed to get existing resource permission: %w", err)
	}

	k8sPermissions := make([]interface{}, 0, len(permissions))
	for _, perm := range permissions {
		if perm.Permission == "" {
			continue
		}

		kind := a.getPermissionKind(perm)
		name := a.getPermissionName(ctx, perm)

		if name == "" {
			continue
		}

		k8sPermissions = append(k8sPermissions, map[string]interface{}{
			"kind": kind,
			"name": name,
			"verb": perm.Permission,
		})
	}

	if len(k8sPermissions) == 0 {
		if existing != nil {
			err = resourcePermResource.Delete(ctx, resourcePermName, metav1.DeleteOptions{})
			if err != nil && !k8serrors.IsNotFound(err) {
				return fmt.Errorf("failed to delete resource permission in k8s: %w", err)
			}
		}
		return nil
	}

	resourcePerm := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(),
			"kind":       iamv0.ResourcePermissionInfo.TypeMeta().Kind,
			"metadata": map[string]interface{}{
				"name":      resourcePermName,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"resource": map[string]interface{}{
					"apiGroup": a.getAPIGroup(),
					"resource": a.service.options.Resource,
					"name":     resourceID,
				},
				"permissions": k8sPermissions,
			},
		},
	}

	if err == nil && existing != nil {
		resourcePerm.SetResourceVersion(existing.GetResourceVersion())
		_, err = resourcePermResource.Update(ctx, resourcePerm, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update resource permission in k8s: %w", err)
		}
	} else {
		_, err = resourcePermResource.Create(ctx, resourcePerm, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create resource permission in k8s: %w", err)
		}
	}

	return nil
}

func (a *api) setUserPermissionToK8s(ctx context.Context, namespace string, resourceID string, userID int64, permission string) error {
	userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return fmt.Errorf("failed to get user details: %w", err)
	}

	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindUser), userDetails.UID, permission)
}

func (a *api) setTeamPermissionToK8s(ctx context.Context, namespace string, resourceID string, teamUID string, permission string) error {
	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindTeam), teamUID, permission)
}

func (a *api) setBuiltInRolePermissionToK8s(ctx context.Context, namespace string, resourceID string, builtInRole string, permission string) error {
	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindBasicRole), builtInRole, permission)
}

func (a *api) setSinglePermissionToK8s(ctx context.Context, namespace string, resourceID string, kind string, name string, permission string) error {
	dynamicClient, err := a.getDynamicClient(ctx)
	if err != nil {
		return err
	}

	resourcePermName := a.buildResourcePermissionName(resourceID)
	resourcePermResource := dynamicClient.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace)

	existing, err := resourcePermResource.Get(ctx, resourcePermName, metav1.GetOptions{})
	if err != nil && !k8serrors.IsNotFound(err) {
		return fmt.Errorf("failed to get existing resource permission: %w", err)
	}

	var existingPermissions []interface{}
	if existing != nil {
		existingPermissions, _, _ = unstructured.NestedSlice(existing.Object, "spec", "permissions")
	}

	newPermissions := make([]interface{}, 0)

	for _, permRaw := range existingPermissions {
		permMap, ok := permRaw.(map[string]interface{})
		if !ok {
			continue
		}

		existingKind, _, _ := unstructured.NestedString(permMap, "kind")
		existingName, _, _ := unstructured.NestedString(permMap, "name")

		if existingKind == kind && existingName == name {
			continue
		}

		newPermissions = append(newPermissions, permMap)
	}

	if permission != "" {
		newPermissions = append(newPermissions, map[string]interface{}{
			"kind": kind,
			"name": name,
			"verb": permission,
		})
	}

	if len(newPermissions) == 0 {
		if existing != nil {
			err = resourcePermResource.Delete(ctx, resourcePermName, metav1.DeleteOptions{})
			if err != nil && !k8serrors.IsNotFound(err) {
				return fmt.Errorf("failed to delete resource permission in k8s: %w", err)
			}
		}
		return nil
	}

	resourcePerm := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(),
			"kind":       iamv0.ResourcePermissionInfo.TypeMeta().Kind,
			"metadata": map[string]interface{}{
				"name":      resourcePermName,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"resource": map[string]interface{}{
					"apiGroup": a.getAPIGroup(),
					"resource": a.service.options.Resource,
					"name":     resourceID,
				},
				"permissions": newPermissions,
			},
		},
	}

	if existing != nil {
		resourcePerm.SetResourceVersion(existing.GetResourceVersion())
		_, err = resourcePermResource.Update(ctx, resourcePerm, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update resource permission in k8s: %w", err)
		}
	} else if permission != "" {
		_, err = resourcePermResource.Create(ctx, resourcePerm, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create resource permission in k8s: %w", err)
		}
	}

	return nil
}

func (a *api) getPermissionKind(perm accesscontrol.SetResourcePermissionCommand) string {
	if perm.UserID != 0 {
		return string(iamv0.ResourcePermissionSpecPermissionKindUser)
	}
	if perm.TeamID != 0 {
		return string(iamv0.ResourcePermissionSpecPermissionKindTeam)
	}
	if perm.BuiltinRole != "" {
		return string(iamv0.ResourcePermissionSpecPermissionKindBasicRole)
	}
	return ""
}

func (a *api) getPermissionName(ctx context.Context, perm accesscontrol.SetResourcePermissionCommand) string {
	if perm.UserID != 0 {
		userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: perm.UserID})
		if err != nil {
			return ""
		}
		return userDetails.UID
	}
	if perm.TeamID != 0 {
		teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
			ID: perm.TeamID,
		})
		if err != nil {
			return ""
		}
		return teamDetails.UID
	}
	if perm.BuiltinRole != "" {
		return perm.BuiltinRole
	}
	return ""
}
