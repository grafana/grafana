package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/authlib/types"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/util/retry"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var ErrRestConfigNotAvailable = errors.New("k8s rest config provider not available")

const subjectKindUser = "User"

func (a *api) getDynamicClient(c *contextmodel.ReqContext) (dynamic.Interface, error) {
	if a.restConfigProvider == nil {
		return nil, ErrRestConfigNotAvailable
	}

	dynamicClient, err := dynamic.NewForConfig(a.restConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return dynamicClient, nil
}

func (a *api) getResourcePermissionsFromK8s(c *contextmodel.ReqContext, namespace string, resourceID string) (getResourcePermissionsResponse, error) {
	ctx := c.Req.Context()
	dynamicClient, err := a.getDynamicClient(c)
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

	// Get provisioned permissions from legacy API
	provisionedDTO, err := a.getProvisionedPermissions(ctx, namespace, resourceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provisioned permissions: %w", err)
	}
	dto = append(dto, provisionedDTO...)

	// Add default Admin role when access control enforcement is disabled
	// This maintains parity with the legacy API behavior
	if a.service.options.Assignments.BuiltInRoles && !a.service.license.FeatureEnabled("accesscontrol.enforcement") {
		permission := a.service.MapActions(accesscontrol.ResourcePermission{
			Actions: a.service.actions,
		})
		if permission != "" {
			dto = append(dto, resourcePermissionDTO{
				BuiltInRole: string(org.RoleAdmin),
				Actions:     a.service.actions,
				Permission:  permission,
				IsManaged:   false,
				IsInherited: false,
			})
		}
	}

	return dto, nil
}

func (a *api) convertK8sResourcePermissionToDTO(resourcePerm *iamv0.ResourcePermission, namespace string, isInherited bool) (getResourcePermissionsResponse, error) {
	namespaceInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace %q: %w", namespace, err)
	}
	orgID := namespaceInfo.OrgID

	permissions := resourcePerm.Spec.Permissions
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
				permDTO.ID = a.getRoleIDFromK8sObject(permDTO.RoleName, orgID)
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
				permDTO.ID = a.getRoleIDFromK8sObject(permDTO.RoleName, orgID)
			} else {
				permDTO.TeamUID = name
				permDTO.Team = name
			}
		case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
			permDTO.BuiltInRole = name
			permDTO.RoleName = fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(name))
			permDTO.ID = a.getRoleIDFromK8sObject(permDTO.RoleName, orgID)
		}

		dto = append(dto, permDTO)
	}

	return dto, nil
}

func (a *api) getRoleIDFromK8sObject(roleName string, orgID int64) int64 {
	if a.service.store == nil {
		return 0
	}

	permissionID, err := a.service.store.GetPermissionIDByRoleName(context.Background(), orgID, roleName)
	if err != nil {
		a.logger.Debug("Failed to get permission ID from legacy database", "error", err, "roleName", roleName, "orgID", orgID)
		return 0
	}

	return permissionID
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
	if a.service.options.Resource == folderv1.RESOURCE {
		return a.getFolderHierarchyPermissions(ctx, namespace, resourceID, dynamicClient, true)
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

		return a.getFolderHierarchyPermissions(ctx, namespace, parentFolderUID, dynamicClient, false)
	}
}

// getFolderHierarchyPermissions gets permissions from a folder and all its parents
// skipSelf: if true, skips the permissions of the folder itself (used for folders to avoid inheriting their own permissions)
func (a *api) getFolderHierarchyPermissions(ctx context.Context, namespace string, folderUID string, dynamicClient dynamic.Interface, skipSelf bool) (getResourcePermissionsResponse, error) {
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
		if skipSelf && parentFolder.Name == folderUID {
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

// getProvisionedPermissions retrieves provisioned permissions from the legacy SQL database
// These are permissions that are neither managed (from K8s) nor inherited
func (a *api) getProvisionedPermissions(ctx context.Context, namespace string, resourceID string) (getResourcePermissionsResponse, error) {
	namespaceInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace %q: %w", namespace, err)
	}
	orgID := namespaceInfo.OrgID

	var inheritedScopes []string
	if a.service.options.InheritedScopesSolver != nil {
		var err error
		inheritedScopes, err = a.service.options.InheritedScopesSolver(ctx, orgID, resourceID)
		if err != nil {
			return nil, fmt.Errorf("failed to get inherited scopes for provisioned permissions: %w", err)
		}
	}

	legacyPermissions, err := a.service.store.GetResourcePermissions(ctx, orgID, GetResourcePermissionsQuery{
		Actions:              a.service.actions,
		Resource:             a.service.options.Resource,
		ResourceID:           resourceID,
		ResourceAttribute:    a.service.options.ResourceAttribute,
		OnlyManaged:          false,
		ExcludeManaged:       true, // SQL-level filter: exclude "managed:" roles to get only provisioned
		InheritedScopes:      inheritedScopes,
		EnforceAccessControl: false,
		User:                 nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get legacy permissions: %w", err)
	}

	// Convert to DTOs
	dto := make(getResourcePermissionsResponse, 0, len(legacyPermissions))
	for _, p := range legacyPermissions {
		if permission := a.service.MapActions(p); permission != "" {
			teamAvatarUrl := ""
			if p.TeamID != 0 {
				teamAvatarUrl = dtos.GetGravatarUrlWithDefault(a.cfg, p.TeamEmail, p.Team)
			}

			dto = append(dto, resourcePermissionDTO{
				ID:               p.ID,
				RoleName:         p.RoleName,
				UserID:           p.UserID,
				UserUID:          p.UserUID,
				UserLogin:        p.UserLogin,
				UserAvatarUrl:    dtos.GetGravatarUrl(a.cfg, p.UserEmail),
				Team:             p.Team,
				TeamID:           p.TeamID,
				TeamUID:          p.TeamUID,
				TeamAvatarUrl:    teamAvatarUrl,
				BuiltInRole:      p.BuiltInRole,
				Actions:          p.Actions,
				Permission:       permission,
				IsManaged:        false,
				IsInherited:      p.IsInherited,
				IsServiceAccount: p.IsServiceAccount,
			})
		}
	}

	return dto, nil
}

func (a *api) buildResourcePermissionName(resourceID string) string {
	return fmt.Sprintf("%s-%s-%s", a.getAPIGroup(), a.service.options.Resource, resourceID)
}

// Write operations

func (a *api) setResourcePermissionsToK8s(c *contextmodel.ReqContext, namespace string, resourceID string, permissions []accesscontrol.SetResourcePermissionCommand) error {
	ctx := c.Req.Context()
	dynamicClient, err := a.getDynamicClient(c)
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

func (a *api) setUserPermissionToK8s(c *contextmodel.ReqContext, namespace string, resourceID string, userID int64, permission string) error {
	ctx := c.Req.Context()
	userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return fmt.Errorf("failed to get user details: %w", err)
	}

	return a.setSinglePermissionToK8s(c, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindUser), userDetails.UID, permission)
}

func (a *api) setTeamPermissionToK8s(c *contextmodel.ReqContext, namespace string, resourceID string, teamID int64, permission string) error {
	ctx := c.Req.Context()
	teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{ID: teamID})
	if err != nil {
		return fmt.Errorf("failed to get team details: %w", err)
	}

	return a.setSinglePermissionToK8s(c, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindTeam), teamDetails.UID, permission)
}

func (a *api) setBuiltInRolePermissionToK8s(c *contextmodel.ReqContext, namespace string, resourceID string, builtInRole string, permission string) error {
	return a.setSinglePermissionToK8s(c, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindBasicRole), builtInRole, permission)
}

func (a *api) setSinglePermissionToK8s(c *contextmodel.ReqContext, namespace string, resourceID string, kind string, name string, permission string) error {
	ctx := c.Req.Context()
	dynamicClient, err := a.getDynamicClient(c)
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

// Teams-specific redirect functions reading and writing Team.Spec.Members.

func (a *api) getTeamPermissionsFromMembers(c *contextmodel.ReqContext, namespace string, resourceID string) (getResourcePermissionsResponse, error) {
	dynamicClient, err := a.getDynamicClient(c)
	if err != nil {
		return nil, err
	}
	return a.listTeamMemberPermissions(c, dynamicClient, namespace, resourceID)
}

func (a *api) listTeamMemberPermissions(c *contextmodel.ReqContext, dynamicClient dynamic.Interface, namespace string, resourceID string) (getResourcePermissionsResponse, error) {
	ctx := c.Req.Context()

	teamID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid team resource ID: %w", err)
	}

	teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
		OrgID: c.GetOrgID(),
		ID:    teamID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get team details: %w", err)
	}

	teamResource := dynamicClient.Resource(iamv0.TeamResourceInfo.GroupVersionResource()).Namespace(namespace)
	teamObj, err := teamResource.Get(ctx, teamDetails.UID, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get team from k8s: %w", err)
	}

	var t iamv0.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(teamObj.Object, &t); err != nil {
		return nil, fmt.Errorf("failed to decode team: %w", err)
	}

	dto := make(getResourcePermissionsResponse, 0, len(t.Spec.Members))
	for _, member := range t.Spec.Members {
		if member.Kind != subjectKindUser {
			continue
		}

		permission, err := teamMemberPermissionToString(member.Permission)
		if err != nil {
			a.logger.Warn("Skipping team member with unknown permission", "error", err, "resource", a.service.options.Resource)
			continue
		}
		// Capitalize for legacy clients and PermissionsToActions, which still
		// key on "Admin"/"Member" rather than the lowercase schema form.
		legacyLabel := cases.Title(language.Und).String(permission)
		actions, exists := a.service.options.PermissionsToActions[legacyLabel]
		if !exists {
			a.logger.Warn("Permission not found in PermissionsToActions map", "permission", legacyLabel, "resource", a.service.options.Resource)
			actions = []string{}
		}

		permDTO := resourcePermissionDTO{
			Permission: legacyLabel,
			Actions:    actions,
			IsManaged:  true,
		}

		userDetails, err := a.service.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: member.Name})
		if err != nil {
			return nil, fmt.Errorf("failed to get user details for UID %s: %w", member.Name, err)
		}

		permDTO.UserID = userDetails.ID
		permDTO.UserUID = userDetails.UID
		permDTO.UserLogin = userDetails.Login
		permDTO.UserAvatarUrl = dtos.GetGravatarUrl(a.cfg, userDetails.Email)
		permDTO.IsServiceAccount = userDetails.IsServiceAccount
		permDTO.RoleName = fmt.Sprintf("managed:users:%d:permissions", userDetails.ID)
		permDTO.ID = a.getRoleIDFromK8sObject(permDTO.RoleName, c.GetOrgID())

		dto = append(dto, permDTO)
	}

	return dto, nil
}

func (a *api) setUserPermissionInTeamMembers(c *contextmodel.ReqContext, namespace string, resourceID string, userID int64, permission string) error {
	dynamicClient, err := a.getDynamicClient(c)
	if err != nil {
		return err
	}
	return a.setTeamMember(c, dynamicClient, namespace, resourceID, userID, permission)
}

func (a *api) setTeamMember(c *contextmodel.ReqContext, dynamicClient dynamic.Interface, namespace string, resourceID string, userID int64, permission string) error {
	ctx := c.Req.Context()

	userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return fmt.Errorf("failed to get user details: %w", err)
	}

	teamID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid team resource ID: %w", err)
	}

	teamDetails, err := a.service.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
		OrgID: c.GetOrgID(),
		ID:    teamID,
	})
	if err != nil {
		return fmt.Errorf("failed to get team details: %w", err)
	}

	var memberPerm iamv0.TeamTeamPermission
	if permission != "" {
		mp, err := stringToTeamMemberPermission(permission)
		if err != nil {
			return err
		}
		memberPerm = mp
	}

	teamResource := dynamicClient.Resource(iamv0.TeamResourceInfo.GroupVersionResource()).Namespace(namespace)

	// Read-modify-write: spec.members is a slice on the Team object so a
	// concurrent writer can lose updates if we don't refetch on conflict.
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		teamObj, err := teamResource.Get(ctx, teamDetails.UID, metav1.GetOptions{})
		if err != nil {
			// Removing a member from a team that no longer exists is a no-op.
			if k8serrors.IsNotFound(err) && permission == "" {
				return nil
			}
			return fmt.Errorf("failed to get team: %w", err)
		}

		var t iamv0.Team
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(teamObj.Object, &t); err != nil {
			return fmt.Errorf("failed to decode team: %w", err)
		}

		idx := slices.IndexFunc(t.Spec.Members, func(m iamv0.TeamTeamMember) bool {
			return m.Kind == subjectKindUser && m.Name == userDetails.UID
		})

		if idx >= 0 && t.Spec.Members[idx].External {
			return nil
		}

		switch {
		case permission == "" && idx < 0:
			return nil
		case permission == "":
			t.Spec.Members = slices.Delete(t.Spec.Members, idx, idx+1)
		case idx >= 0:
			if t.Spec.Members[idx].Permission == memberPerm {
				return nil
			}
			t.Spec.Members[idx].Permission = memberPerm
		default:
			t.Spec.Members = append(t.Spec.Members, iamv0.TeamTeamMember{
				Kind:       subjectKindUser,
				Name:       userDetails.UID,
				Permission: memberPerm,
				External:   false,
			})
		}

		updatedObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&t)
		if err != nil {
			return fmt.Errorf("failed to encode team: %w", err)
		}

		if _, err := teamResource.Update(ctx, &unstructured.Unstructured{Object: updatedObj}, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to update team members: %w", err)
		}
		return nil
	})
}

// teamMemberPermissionToString returns the lowercase schema value ("admin",
// "member") that matches teammember.cue.
func teamMemberPermissionToString(p iamv0.TeamTeamPermission) (string, error) {
	switch p {
	case iamv0.TeamTeamPermissionAdmin:
		return "admin", nil
	case iamv0.TeamTeamPermissionMember:
		return "member", nil
	default:
		return "", fmt.Errorf("unhandled TeamTeamPermission %q", p)
	}
}

func stringToTeamMemberPermission(s string) (iamv0.TeamTeamPermission, error) {
	switch strings.ToLower(s) {
	case "admin":
		return iamv0.TeamTeamPermissionAdmin, nil
	case "member":
		return iamv0.TeamTeamPermissionMember, nil
	default:
		return "", fmt.Errorf("unsupported team permission %q", s)
	}
}
