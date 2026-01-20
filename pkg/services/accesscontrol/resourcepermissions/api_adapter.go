package resourcepermissions

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/authlib/types"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var ErrRestConfigNotAvailable = errors.New("k8s rest config provider not available")

func (a *api) getDynamicClient(ctx context.Context) (dynamic.Interface, error) {
	if a.restConfigProvider == nil {
		return nil, ErrRestConfigNotAvailable
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
	unstructuredObj, err := resourcePermResource.Get(ctx, resourcePermName, metav1.GetOptions{})

	dto := make(getResourcePermissionsResponse, 0)

	if err != nil && !k8serrors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to get resource permission from k8s: %w", err)
	}

	if unstructuredObj != nil {
		var resourcePerm iamv0.ResourcePermission
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(unstructuredObj.Object, &resourcePerm); err != nil {
			return nil, fmt.Errorf("failed to convert to typed resource permission: %w", err)
		}

		directDTO, err := a.convertK8sResourcePermissionToDTO(&resourcePerm, namespace, false)
		if err != nil {
			return nil, err
		}
		dto = append(dto, directDTO...)
	}

	inheritedDTO, err := a.GetInheritedPermissions(ctx, namespace, resourceID, dynamicClient)
	if err != nil {
		a.logger.Warn("Failed to get inherited permissions from k8s API", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
	} else {
		dto = append(dto, inheritedDTO...)
	}

	return dto, nil
}

func (a *api) convertK8sResourcePermissionToDTO(resourcePerm *iamv0.ResourcePermission, namespace string, isInherited bool) (getResourcePermissionsResponse, error) {
	permissions := resourcePerm.Spec.Permissions
	if len(permissions) == 0 {
		return getResourcePermissionsResponse{}, nil
	}

	namespaceInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace %q: %w", namespace, err)
	}
	orgID := namespaceInfo.OrgID

	dto := make(getResourcePermissionsResponse, 0, len(permissions))

	for _, perm := range permissions {
		kind := perm.Kind
		name := perm.Name
		verb := perm.Verb

		if name == "" || verb == "" {
			continue
		}

		permission := cases.Title(language.Und).String(verb)
		actions, exists := a.service.options.PermissionsToActions[permission]
		if !exists {
			log.New("resource-permissions-api").Warn(
				"Permission not found in PermissionsToActions map",
				"permission", permission,
				"resource", a.service.options.Resource,
				"availablePermissions", fmt.Sprintf("%v", getMapKeys(a.service.options.PermissionsToActions)),
			)
			actions = []string{}
		}

		permDTO := resourcePermissionDTO{
			Permission:  permission,
			Actions:     actions,
			IsManaged:   true,
			IsInherited: isInherited,
		}

		switch kind {
		case iamv0.ResourcePermissionSpecPermissionKindUser, iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
			userDetails, err := a.service.userService.GetByUID(context.Background(), &user.GetUserByUIDQuery{UID: name})
			if err == nil {
				permDTO.UserID = userDetails.ID
				permDTO.UserUID = userDetails.UID
				permDTO.UserLogin = userDetails.Login
				permDTO.UserAvatarUrl = dtos.GetGravatarUrl(a.cfg, userDetails.Email)
				permDTO.IsServiceAccount = userDetails.IsServiceAccount
				permDTO.RoleName = fmt.Sprintf("managed:users:%d:permissions", userDetails.ID)
			}
		case iamv0.ResourcePermissionSpecPermissionKindTeam:
			teamDetails, err := a.service.teamService.GetTeamByID(context.Background(), &team.GetTeamByIDQuery{
				UID:   name,
				OrgID: orgID,
			})
			if err == nil {
				permDTO.Team = teamDetails.Name
				permDTO.TeamID = teamDetails.ID
				permDTO.TeamUID = teamDetails.UID
				permDTO.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(a.cfg, teamDetails.Email, teamDetails.Name)
				permDTO.RoleName = fmt.Sprintf("managed:teams:%d:permissions", teamDetails.ID)
			} else {
				permDTO.TeamUID = name
				permDTO.Team = name
			}
		case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
			permDTO.BuiltInRole = name
			permDTO.RoleName = fmt.Sprintf("managed:builtins:%s:permissions", name)
		}

		dto = append(dto, permDTO)
	}

	return dto, nil
}

func (a *api) getAPIGroup() string {
	if a.service.options.APIGroup != "" {
		return a.service.options.APIGroup
	}
	return fmt.Sprintf("%s.grafana.app", a.service.options.Resource)
}

func getMapKeys(m map[string][]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func (a *api) GetInheritedPermissions(ctx context.Context, namespace string, resourceID string, dynamicClient dynamic.Interface) (getResourcePermissionsResponse, error) {

	if a.service.options.Resource == "folders" {
		return a.getFolderHierarchyPermissions(ctx, namespace, resourceID, dynamicClient)
	} else {
		if a.service.options.GetParentFolder == nil {
			return getResourcePermissionsResponse{}, nil
		}

		parentFolderUID, err := a.service.options.GetParentFolder(ctx, namespace, resourceID, dynamicClient)
		if err != nil {
			return nil, fmt.Errorf("failed to get parent folder: %w", err)
		}

		if parentFolderUID == "" {
			// Root-level resource, no inherited permissions
			return getResourcePermissionsResponse{}, nil
		}

		return a.getFolderHierarchyPermissions(ctx, namespace, parentFolderUID, dynamicClient)
	}
}

// getFolderHierarchyPermissions gets permissions from a folder and all its parents
func (a *api) getFolderHierarchyPermissions(ctx context.Context, namespace string, folderUID string, dynamicClient dynamic.Interface) (getResourcePermissionsResponse, error) {
	foldersGVR := schema.GroupVersionResource{
		Group:    folderv1.APIGroup,
		Version:  folderv1.APIVersion,
		Resource: folderv1.RESOURCE,
	}

	// GET /apis/folder.grafana.app/v1beta1/namespaces/{namespace}/folders/{folderUID}/parents
	parentsResource := dynamicClient.Resource(foldersGVR).Namespace(namespace)
	unstructuredResult, err := parentsResource.Get(ctx, folderUID, metav1.GetOptions{}, "parents")
	if err != nil {
		if k8serrors.IsNotFound(err) {
			// Folder not found or no parents
			return getResourcePermissionsResponse{}, nil
		}
		return nil, fmt.Errorf("failed to get folder parents from k8s: %w", err)
	}

	var folderInfoList folderv1.FolderInfoList
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(unstructuredResult.Object, &folderInfoList); err != nil {
		return nil, fmt.Errorf("failed to convert folder parents response: %w", err)
	}

	if len(folderInfoList.Items) == 0 {
		return getResourcePermissionsResponse{}, nil
	}

	allInheritedPermissions := make(getResourcePermissionsResponse, 0)
	resourcePermResource := dynamicClient.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource()).Namespace(namespace)

	for _, parentFolder := range folderInfoList.Items {
		if parentFolder.Detached {
			a.logger.Debug("Skipping detached parent folder", "folderName", parentFolder.Name)
			continue
		}

		if parentFolder.Name == folderUID {
			continue
		}

		parentPermName := fmt.Sprintf("%s-folders-%s", folderv1.APIGroup, parentFolder.Name)

		unstructuredObj, err := resourcePermResource.Get(ctx, parentPermName, metav1.GetOptions{})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				continue
			}
			a.logger.Warn("Failed to get parent folder permission from k8s", "error", err, "parentFolder", parentFolder.Name)
			continue
		}

		var parentResourcePerm iamv0.ResourcePermission
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(unstructuredObj.Object, &parentResourcePerm); err != nil {
			a.logger.Warn("Failed to convert parent folder permission", "error", err, "parentFolder", parentFolder.Name)
			continue
		}

		inheritedDTO, err := a.convertK8sResourcePermissionToDTO(&parentResourcePerm, namespace, true)
		if err != nil {
			a.logger.Warn("Failed to convert parent folder permissions to DTO", "error", err, "parentFolder", parentFolder.Name)
			continue
		}

		allInheritedPermissions = append(allInheritedPermissions, inheritedDTO...)
	}

	return allInheritedPermissions, nil
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

	_, existingResourceVersion, err := a.getExistingResourcePermission(ctx, resourcePermResource, resourcePermName)
	if err != nil {
		return err
	}

	k8sPermissions := make([]iamv0.ResourcePermissionspecPermission, 0, len(permissions))
	for _, perm := range permissions {
		if perm.Permission == "" {
			continue
		}

		kind := a.getPermissionKind(perm)
		name, err := a.getPermissionName(ctx, perm)
		if err != nil {
			return fmt.Errorf("failed to get permission name: %w", err)
		}

		k8sPermissions = append(k8sPermissions, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKind(kind),
			Name: name,
			Verb: cases.Lower(language.Und).String(perm.Permission),
		})
	}

	if len(k8sPermissions) == 0 {
		if existingResourceVersion != "" {
			err = resourcePermResource.Delete(ctx, resourcePermName, metav1.DeleteOptions{})
			if err != nil && !k8serrors.IsNotFound(err) {
				return fmt.Errorf("failed to delete resource permission in k8s: %w", err)
			}
		}
		return nil
	}

	resourcePerm := &iamv0.ResourcePermission{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0.ResourcePermissionInfo.GroupVersion().String(),
			Kind:       iamv0.ResourcePermissionInfo.TypeMeta().Kind,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:            resourcePermName,
			Namespace:       namespace,
			ResourceVersion: existingResourceVersion,
		},
		Spec: iamv0.ResourcePermissionSpec{
			Resource: iamv0.ResourcePermissionspecResource{
				ApiGroup: a.getAPIGroup(),
				Resource: a.service.options.Resource,
				Name:     resourceID,
			},
			Permissions: k8sPermissions,
		},
	}

	return a.createOrUpdateResourcePermission(ctx, resourcePermResource, resourcePerm, existingResourceVersion != "")
}

func (a *api) setUserPermissionToK8s(ctx context.Context, namespace string, resourceID string, userID int64, permission string) error {
	userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return fmt.Errorf("failed to get user details: %w", err)
	}

	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindUser), userDetails.UID, permission)
}

func (a *api) setTeamPermissionToK8s(ctx context.Context, namespace string, resourceID string, teamID int64, permission string) error {
	teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{ID: teamID})
	if err != nil {
		return fmt.Errorf("failed to get team details: %w", err)
	}

	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindTeam), teamDetails.UID, permission)
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

	existingResourcePerm, existingResourceVersion, err := a.getExistingResourcePermission(ctx, resourcePermResource, resourcePermName)
	if err != nil {
		return err
	}

	newPermissions := make([]iamv0.ResourcePermissionspecPermission, 0)
	for _, perm := range existingResourcePerm.Spec.Permissions {
		if string(perm.Kind) == kind && perm.Name == name {
			continue
		}
		newPermissions = append(newPermissions, perm)
	}

	if permission != "" {
		newPermissions = append(newPermissions, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKind(kind),
			Name: name,
			Verb: cases.Lower(language.Und).String(permission),
		})
	}

	if len(newPermissions) == 0 {
		if existingResourceVersion != "" {
			err = resourcePermResource.Delete(ctx, resourcePermName, metav1.DeleteOptions{})
			if err != nil && !k8serrors.IsNotFound(err) {
				return fmt.Errorf("failed to delete resource permission in k8s: %w", err)
			}
		}
		return nil
	}

	resourcePerm := &iamv0.ResourcePermission{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0.ResourcePermissionInfo.GroupVersion().String(),
			Kind:       iamv0.ResourcePermissionInfo.TypeMeta().Kind,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:            resourcePermName,
			Namespace:       namespace,
			ResourceVersion: existingResourceVersion,
		},
		Spec: iamv0.ResourcePermissionSpec{
			Resource: iamv0.ResourcePermissionspecResource{
				ApiGroup: a.getAPIGroup(),
				Resource: a.service.options.Resource,
				Name:     resourceID,
			},
			Permissions: newPermissions,
		},
	}

	return a.createOrUpdateResourcePermission(ctx, resourcePermResource, resourcePerm, existingResourceVersion != "")
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

func (a *api) getExistingResourcePermission(ctx context.Context, resourcePermResource dynamic.ResourceInterface, resourcePermName string) (*iamv0.ResourcePermission, string, error) {
	unstructuredObj, err := resourcePermResource.Get(ctx, resourcePermName, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return &iamv0.ResourcePermission{}, "", nil
		}
		return nil, "", fmt.Errorf("failed to get existing resource permission: %w", err)
	}

	var resourcePerm iamv0.ResourcePermission
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(unstructuredObj.Object, &resourcePerm); err != nil {
		return nil, "", fmt.Errorf("failed to convert existing resource permission: %w", err)
	}

	return &resourcePerm, unstructuredObj.GetResourceVersion(), nil
}

func (a *api) createOrUpdateResourcePermission(ctx context.Context, resourcePermResource dynamic.ResourceInterface, resourcePerm *iamv0.ResourcePermission, isUpdate bool) error {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resourcePerm)
	if err != nil {
		return fmt.Errorf("failed to convert resource permission to unstructured: %w", err)
	}
	unstructuredPerm := &unstructured.Unstructured{Object: unstructuredObj}

	if isUpdate {
		_, err = resourcePermResource.Update(ctx, unstructuredPerm, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update resource permission in k8s: %w", err)
		}
	} else {
		_, err = resourcePermResource.Create(ctx, unstructuredPerm, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create resource permission in k8s: %w", err)
		}
	}

	return nil
}

func (a *api) getPermissionName(ctx context.Context, perm accesscontrol.SetResourcePermissionCommand) (string, error) {
	if perm.UserID != 0 {
		userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: perm.UserID})
		if err != nil {
			return "", fmt.Errorf("failed to get user details for user ID %d: %w", perm.UserID, err)
		}
		return userDetails.UID, nil
	}
	if perm.TeamID != 0 {
		teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
			ID: perm.TeamID,
		})
		if err != nil {
			return "", fmt.Errorf("failed to get team details for team ID %d: %w", perm.TeamID, err)
		}
		return teamDetails.UID, nil
	}
	if perm.BuiltinRole != "" {
		return perm.BuiltinRole, nil
	}
	return "", fmt.Errorf("no valid permission subject found")
}
