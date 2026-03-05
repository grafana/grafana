package authorizer

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
)

type RoleGetter interface {
	Get(ctx context.Context, name string) (*iamv0.Role, error)
}

type mappingInfo struct {
	group    string
	resource string
	verb     string
}

// RolePermissionValidator checks that the current user has all permissions in a role.
// This is used by roles and role bindings authorization.
// It will translate legacy RBAC actions to K8s format when possible, otherwise it will fallback
// to using legacy accesscontrol
type RolePermissionValidator struct {
	accessClient types.AccessClient
	mapper       rbac.MapperRegistry
	logger       log.Logger

	// ac is for legacy permissions not yet in the mapper. if nil, will reject legacy permissions not in the mapper.
	ac accesscontrol.AccessControl

	// reverseActionMap is a cached reverse lookup from RBAC action to K8s mapping
	// e.g. "dashboards:read" -> {group: "dashboard.grafana.app", resource: "dashboards", verb: "get"}
	reverseActionMap map[string]mappingInfo
}

func NewRolePermissionValidator(accessClient types.AccessClient, ac accesscontrol.AccessControl) *RolePermissionValidator {
	v := &RolePermissionValidator{
		accessClient: accessClient,
		ac:           ac,
		mapper:       rbac.NewMapperRegistry(),
		logger:       log.New("iam.role.permission-validator"),
	}
	v.buildReverseActionMap()
	return v
}

func (v *RolePermissionValidator) buildReverseActionMap() {
	v.reverseActionMap = make(map[string]mappingInfo)

	allVerbs := []string{
		utils.VerbGet,
		utils.VerbList,
		utils.VerbWatch,
		utils.VerbCreate,
		utils.VerbUpdate,
		utils.VerbPatch,
		utils.VerbDelete,
		utils.VerbDeleteCollection,
		utils.VerbGetPermissions,
		utils.VerbSetPermissions,
	}

	for _, group := range v.mapper.GetGroups() {
		mappings := v.mapper.GetAll(group)
		for _, mapping := range mappings {
			for _, k8sVerb := range allVerbs {
				if action, ok := mapping.Action(k8sVerb); ok {
					v.reverseActionMap[action] = mappingInfo{
						group:    group,
						resource: mapping.Resource(),
						verb:     k8sVerb,
					}
				}
			}
		}
	}
}

// ValidateUserCanDelegateRole returns an error if the current user does not have every permission in the role.
func (v *RolePermissionValidator) ValidateUserCanDelegateRole(ctx context.Context, role *iamv0.Role) error {
	return v.ValidateUserCanDelegatePermissions(ctx, role.Spec.Permissions)
}

// ValidateUserCanDelegatePermissions returns an error if the current user does not have every permission
// in the list (used for Role, CoreRole, and GlobalRole refs in role bindings).
func (v *RolePermissionValidator) ValidateUserCanDelegatePermissions(ctx context.Context, perms []iamv0.RolespecPermission) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("valid user is required: %w", err)
	}
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("no auth info in context")
	}
	for _, perm := range perms {
		if err := v.validatePermission(ctx, authInfo, user, perm); err != nil {
			return err
		}
	}
	return nil
}

// validatePermission validates a single permission from a role. it both validates that the format is correct
// and that the user has the permission to delegate it
func (v *RolePermissionValidator) validatePermission(ctx context.Context, authInfo types.AuthInfo, user identity.Requester, perm iamv0.RolespecPermission) error {
	parsed, err := v.parsePermission(perm.Action, perm.Scope)
	if err != nil {
		return err
	}
	return v.checkUserCanDelegatePermission(ctx, authInfo, user, parsed)
}

type action struct {
	group    string // will be empty for legacy permissions
	resource string
	verb     string
}

type scope struct {
	name          string
	folder        bool
	originalScope string // preserve the original scope string for legacy permissions
}

type permission struct {
	k8sPermission bool
	action        action
	scope         scope
}

// parsePermission validates the permission action format.
// accepts both legacy format (resource:verb) and k8s format (group/resource:verb) for actions
// and "resource:attribute:value" for scopes (e.g., "dashboards:uid:my-dashboard" or "dashboards.grafana.app/dashboards:*")
//
// returns a permission struct with the parsed information
func (v *RolePermissionValidator) parsePermission(act, sc string) (*permission, error) {
	resource, verb, err := getResourceVerb(act)
	if err != nil {
		return nil, err
	}

	perm := permission{
		k8sPermission: false,
		action: action{
			group:    "",
			resource: resource,
			verb:     verb,
		},
		scope: scope{
			name:   "",
			folder: false,
		},
	}

	// k8s format: contains "/" (apigroup/resource)
	if strings.Contains(resource, "/") {
		// try to split on valid domain suffixes
		validSuffixes := []string{".grafana.app/", ".ext.grafana.com/", ".grafana.com/", ".plugins.grafana.com/"}
		var parts []string
		var matchedSuffix string
		for _, suffix := range validSuffixes {
			if strings.Contains(resource, suffix) {
				parts = strings.Split(resource, suffix)
				matchedSuffix = suffix
				break
			}
		}
		if len(parts) != 2 || matchedSuffix == "" {
			return nil, fmt.Errorf("invalid K8s action format: %s (expected '<app>.<domain>/resource:verb' where domain is one of: grafana.app, ext.grafana.com, grafana.com, plugins.grafana.com)", act)
		}
		perm.action.group = parts[0] + matchedSuffix[:len(matchedSuffix)-1]
		perm.action.resource = parts[1]
		perm.k8sPermission = true
	}

	// parse the scope, but still store original scope for legacy permissions
	// scopes can be in multiple formats:
	// 1. Legacy: "resource:attribute:value" (e.g., "dashboards:uid:xyz"), "resource:*", "*", "folders:*", or empty
	// 2. K8s: "apigroup/resource:uid:name", "apigroup/resource:*", or folder-based
	perm.scope.originalScope = sc

	if sc == "" {
		return &perm, nil
	}

	scopeResource, attribute, name := accesscontrol.SplitScope(sc)
	perm.scope.name = name

	// k8s roles should only use UID-based scopes for teams, users, and service accounts
	// reject ID-based scopes (attribute == "id") for these resources
	if attribute == "id" {
		return nil, fmt.Errorf("roles no longer support ID-based scopes for %s. Use uid-based scopes instead", scopeResource)
	}

	if scopeResource == "folders" || scopeResource == "folder.grafana.app" {
		perm.scope.folder = true
	}

	return &perm, nil
}

// checkUserCanDelegatePermission checks if the user has permission to delegate the given permission.
func (v *RolePermissionValidator) checkUserCanDelegatePermission(ctx context.Context, authInfo types.AuthInfo, user identity.Requester, perm *permission) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("no auth info in context")
	}

	// if not already marked as k8s permission, try to find the mapping to translate legacy RBAC to K8s format
	if !perm.k8sPermission {
		group, resource, verb, ok := v.translateRBACActionToK8s(perm.action.resource, perm.action.verb)
		if ok {
			perm.k8sPermission = true
			perm.action.group = group
			perm.action.verb = verb
			perm.action.resource = resource
		}
	}

	if perm.k8sPermission {
		// k8s app permission (e.g., "dashboards.grafana.app/dashboards:get")
		return v.checkPermission(ctx, authInfo, perm)
	}
	// legacy permission not in mapper - check it using legacy format
	return v.checkLegacyPermission(ctx, authInfo, user, perm)
}

func (v *RolePermissionValidator) translateRBACActionToK8s(rbacResource, rbacVerb string) (group, resource, verb string, ok bool) {
	// datasources use wildcard group *.datasource.grafana.app which is not supported server-side (yet?)
	// for now, fall back to legacy permission check for datasources
	if strings.HasSuffix(rbacResource, ".datasource") || rbacResource == "datasources" || rbacResource == "datasources.permissions" {
		return "", "", "", false
	}
	targetAction := fmt.Sprintf("%s:%s", rbacResource, rbacVerb)
	if info, ok := v.reverseActionMap[targetAction]; ok {
		return info.group, info.resource, info.verb, true
	}
	return "", "", "", false
}

// checkPermission checks permission using the raw action and scope. this is used for k8s style permissions
func (v *RolePermissionValidator) checkPermission(ctx context.Context, authInfo types.AuthInfo, perm *permission) error {
	// the name in the parsedPermission scope is either a folder uid or the uid of the given resource
	resourceName := ""
	folder := ""
	if perm.scope.name != "" {
		if perm.scope.folder {
			folder = perm.scope.name
		} else {
			resourceName = perm.scope.name
		}
	}

	// should be able to access all resources of this type then
	if folder == "*" {
		resourceName = "*"
	}

	res, err := v.accessClient.Check(ctx, authInfo, types.CheckRequest{
		Verb:      perm.action.verb,
		Group:     perm.action.group,
		Resource:  perm.action.resource,
		Namespace: authInfo.GetNamespace(),
		Name:      resourceName,
	}, folder)

	if err != nil {
		v.logger.Debug("app permission delegation check failed with error",
			"user", authInfo.GetIdentifier(),
			"action", perm.action.verb,
			"folder", folder,
			"resourceName", resourceName,
			"group", perm.action.group,
			"resource", perm.action.resource,
			"verb", perm.action.verb,
			"error", err,
		)
		return fmt.Errorf("cannot delegate app permission: group %s resource %s verb %s on scope '%s': %w", perm.action.group, perm.action.resource, perm.action.verb, resourceName, err)
	}

	if !res.Allowed {
		v.logger.Debug("app permission delegation check denied",
			"user", authInfo.GetIdentifier(),
			"action", perm.action.verb,
			"folder", folder,
			"resourceName", resourceName,
			"group", perm.action.group,
			"resource", perm.action.resource,
			"verb", perm.action.verb,
		)
		return fmt.Errorf("cannot delegate app permission: group %s resource %s verb %s on scope '%s': you do not have this permission", perm.action.group, perm.action.resource, perm.action.verb, resourceName)
	}

	v.logger.Debug("app permission delegation check passed",
		"user", authInfo.GetIdentifier(),
		"action", perm.action.verb,
		"folder", folder,
		"resourceName", resourceName,
		"group", perm.action.group,
		"resource", perm.action.resource,
		"verb", perm.action.verb,
	)

	return nil
}

// checkLegacyPermission handles legacy RBAC format permissions using the AccessControl service.
// solely used for legacy perms NOT in the mapper, and only in ST mode.
func (v *RolePermissionValidator) checkLegacyPermission(ctx context.Context, authInfo types.AuthInfo, user identity.Requester, perm *permission) error {
	// for legacy permissions, reconstruct the full action (e.g., "annotations:read")
	fullAction := perm.action.resource + ":" + perm.action.verb

	// if AccessControl is nil, legacy permissions are not supported
	if v.ac == nil {
		v.logger.Debug("legacy permission check not supported",
			"user", authInfo.GetIdentifier(),
			"action", fullAction,
			"scope", perm.scope.originalScope,
		)
		return apierrors.NewBadRequest(fmt.Sprintf("legacy permission '%s' on scope '%s' is not supported: use K8s format permissions (group/resource:verb) instead", fullAction, perm.scope.originalScope))
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("failed to get user from context: %w", err)
	}

	v.logger.Debug("checking legacy permission not in mapper using AccessControl",
		"user", authInfo.GetIdentifier(),
		"action", fullAction,
		"scope", perm.scope.originalScope,
	)

	// use the original scope string directly for legacy permission checks
	var evaluator accesscontrol.Evaluator
	if perm.scope.originalScope == "" {
		evaluator = accesscontrol.EvalPermission(fullAction)
	} else {
		evaluator = accesscontrol.EvalPermission(fullAction, perm.scope.originalScope)
	}

	// use the accesscontrol service to evaluate the permission
	allowed, err := v.ac.Evaluate(ctx, user, evaluator)
	if err != nil {
		v.logger.Debug("legacy permission delegation check failed with error",
			"user", authInfo.GetIdentifier(),
			"action", fullAction,
			"scope", perm.scope.originalScope,
			"error", err,
		)
		return fmt.Errorf("cannot delegate legacy permission '%s' on scope '%s': %w", fullAction, perm.scope.originalScope, err)
	}

	if !allowed {
		v.logger.Debug("legacy permission delegation check denied",
			"user", authInfo.GetIdentifier(),
			"action", fullAction,
			"scope", perm.scope.originalScope,
		)
		return fmt.Errorf("cannot delegate legacy permission '%s' on scope '%s': you do not have this permission", fullAction, perm.scope.originalScope)
	}

	v.logger.Debug("legacy permission delegation check passed",
		"user", authInfo.GetIdentifier(),
		"action", fullAction,
		"scope", perm.scope.originalScope,
	)

	return nil
}

func getResourceVerb(action string) (string, string, error) {
	parts := strings.SplitN(action, ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid action format, expected 'resource:verb': %s", action)
	}
	if parts[0] == "" {
		return "", "", fmt.Errorf("invalid action format, resource must be defined: %s", action)
	}
	if parts[1] == "" {
		return "", "", fmt.Errorf("invalid action format, verb must be defined: %s", action)
	}
	return parts[0], parts[1], nil
}

// RoleRefResolver returns the permissions for a role ref (Role, CoreRole, or GlobalRole) by kind and name.
// Used to validate that the user can delegate every permission when creating a role binding.
type RoleRefResolver interface {
	GetPermissionsForRef(ctx context.Context, kind, name string) ([]iamv0.RolespecPermission, error)
}

// RoleRefResolverFromConfigProvider returns a RoleRefResolver that uses the given config provider
// to fetch Role, CoreRole, or GlobalRole via the dynamic client.
func RoleRefResolverFromConfigProvider(configProvider ConfigProvider) RoleRefResolver {
	return &roleRefResolver{configProvider: configProvider}
}

type roleRefResolver struct {
	configProvider ConfigProvider
}

func (r *roleRefResolver) GetPermissionsForRef(ctx context.Context, kind, name string) ([]iamv0.RolespecPermission, error) {
	cfg, err := r.configProvider(ctx)
	if err != nil {
		return nil, err
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	var gvr schema.GroupVersionResource
	var namespace string
	switch kind {
	case string(iamv0.RoleBindingSpecRoleRefKindRole):
		gvr = iamv0.RoleInfo.GroupVersionResource()
		namespace = getRequestNamespace(ctx)
	case string(iamv0.RoleBindingSpecRoleRefKindCoreRole):
		gvr = iamv0.CoreRoleInfo.GroupVersionResource()
		namespace = getRequestNamespace(ctx)
	case string(iamv0.RoleBindingSpecRoleRefKindGlobalRole):
		gvr = iamv0.GlobalRoleInfo.GroupVersionResource()
		namespace = "" // cluster-scoped
	default:
		return nil, fmt.Errorf("unsupported role ref kind: %s", kind)
	}

	var raw runtime.Object
	if namespace != "" {
		raw, err = client.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		raw, err = client.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}
	if err != nil {
		return nil, err
	}
	unstruct, ok := raw.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("unexpected type %T for role %s/%s", raw, kind, name)
	}

	obj := unstruct.UnstructuredContent()
	spec, ok := obj["spec"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("role %s/%s has no spec", kind, name)
	}
	rawPerms, _ := spec["permissions"].([]interface{})
	out := make([]iamv0.RolespecPermission, 0, len(rawPerms))
	for _, p := range rawPerms {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		action, _ := pm["action"].(string)
		scope, _ := pm["scope"].(string)
		out = append(out, iamv0.RolespecPermission{Action: action, Scope: scope})
	}
	return out, nil
}

func getRequestNamespace(ctx context.Context) string {
	if authInfo, ok := types.AuthInfoFrom(ctx); ok && authInfo.GetNamespace() != "" {
		return authInfo.GetNamespace()
	}
	return "default"
}

// RoleGetterFromConfigProvider returns a RoleGetter that uses the given config provider
// to create a dynamic client and fetch Roles from the API.
func RoleGetterFromConfigProvider(configProvider ConfigProvider) RoleGetter {
	return &configRoleGetter{configProvider: configProvider}
}

type configRoleGetter struct {
	configProvider ConfigProvider
}

func (g *configRoleGetter) Get(ctx context.Context, name string) (*iamv0.Role, error) {
	resolver := &roleRefResolver{configProvider: g.configProvider}
	perms, err := resolver.GetPermissionsForRef(ctx, string(iamv0.RoleBindingSpecRoleRefKindRole), name)
	if err != nil {
		return nil, err
	}
	return &iamv0.Role{Spec: iamv0.RoleSpec{Permissions: perms}}, nil
}
