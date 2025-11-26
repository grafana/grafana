package resourcepermissions

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
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

	return a.convertK8sResourcePermissionToDTO(resourcePerm, namespace)
}

func (a *api) convertK8sResourcePermissionToDTO(resourcePerm *unstructured.Unstructured, namespace string) (getResourcePermissionsResponse, error) {
	permissions, found, err := unstructured.NestedSlice(resourcePerm.Object, "spec", "permissions")
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions from spec: %w", err)
	}
	if !found {
		return getResourcePermissionsResponse{}, nil
	}

	namespaceInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		log.New("resource-permissions-api").Warn("Failed to parse namespace for orgID", "namespace", namespace, "error", err)
	}
	orgID := namespaceInfo.OrgID

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
			teamDetails, err := a.service.teamService.GetTeamByID(context.Background(), &team.GetTeamByIDQuery{
				UID:   name,
				OrgID: orgID,
			})
			if err == nil {
				permDTO.Team = teamDetails.Name
				permDTO.TeamID = teamDetails.ID
				permDTO.TeamUID = teamDetails.UID
				permDTO.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(a.cfg, teamDetails.Email, teamDetails.Name)
			} else {
				permDTO.TeamUID = name
				permDTO.Team = name
			}
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
		return folderv1.APIGroup
	case "dashboards":
		return dashboardv1.APIGroup
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
