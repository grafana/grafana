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

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
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
