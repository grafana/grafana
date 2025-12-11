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
	"k8s.io/client-go/dynamic"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return getResourcePermissionsResponse{}, nil
		}
		return nil, fmt.Errorf("failed to get resource permission from k8s: %w", err)
	}

	var resourcePerm iamv0.ResourcePermission
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(unstructuredObj.Object, &resourcePerm); err != nil {
		return nil, fmt.Errorf("failed to convert to typed resource permission: %w", err)
	}

	return a.convertK8sResourcePermissionToDTO(&resourcePerm, namespace)
}

func (a *api) convertK8sResourcePermissionToDTO(resourcePerm *iamv0.ResourcePermission, namespace string) (getResourcePermissionsResponse, error) {
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
			IsInherited: false,
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

	k8sPermissions := make([]iamv0.ResourcePermissionspecPermission, 0, len(permissions))
	for _, perm := range permissions {
		if perm.Permission == "" {
			continue
		}

		kind := a.getPermissionKind(perm)
		name := a.getPermissionName(ctx, perm)

		if name == "" {
			continue
		}

		k8sPermissions = append(k8sPermissions, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKind(kind),
			Name: name,
			Verb: cases.Lower(language.Und).String(perm.Permission),
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

	resourcePerm := &iamv0.ResourcePermission{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0.ResourcePermissionInfo.GroupVersion().String(),
			Kind:       iamv0.ResourcePermissionInfo.TypeMeta().Kind,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      resourcePermName,
			Namespace: namespace,
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

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resourcePerm)
	if err != nil {
		return fmt.Errorf("failed to convert resource permission to unstructured: %w", err)
	}
	unstructuredPerm := &unstructured.Unstructured{Object: unstructuredObj}

	if existing != nil {
		unstructuredPerm.SetResourceVersion(existing.GetResourceVersion())
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

func (a *api) setUserPermissionToK8s(ctx context.Context, namespace string, resourceID string, userID int64, permission string) error {
	userDetails, err := a.service.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return fmt.Errorf("failed to get user details: %w", err)
	}

	return a.setSinglePermissionToK8s(ctx, namespace, resourceID, string(iamv0.ResourcePermissionSpecPermissionKindUser), userDetails.UID, permission)
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

	var existingResourcePerm iamv0.ResourcePermission
	if existing != nil {
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(existing.Object, &existingResourcePerm); err != nil {
			return fmt.Errorf("failed to convert existing resource permission: %w", err)
		}
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
		if existing != nil {
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
			Name:      resourcePermName,
			Namespace: namespace,
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

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resourcePerm)
	if err != nil {
		return fmt.Errorf("failed to convert resource permission to unstructured: %w", err)
	}
	unstructuredPerm := &unstructured.Unstructured{Object: unstructuredObj}

	if existing != nil {
		unstructuredPerm.SetResourceVersion(existing.GetResourceVersion())
		_, err = resourcePermResource.Update(ctx, unstructuredPerm, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update resource permission in k8s: %w", err)
		}
	} else if permission != "" {
		_, err = resourcePermResource.Create(ctx, unstructuredPerm, metav1.CreateOptions{})
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
