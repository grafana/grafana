package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// restConfigProvider is a minimal interface for obtaining a per-request K8s client config.
// It matches the relevant subset of apiserver.DirectRestConfigProvider.
type restConfigProvider interface {
	GetDirectRestConfig(c *contextmodel.ReqContext) *rest.Config
}

// k8sPermissionResolver resolves user permissions by calling the K8s IAM APIs.
// This is used when FlagKubernetesAuthzRolesAndRoleBindingsRedirect is enabled.
type k8sPermissionResolver struct {
	restConfigProvider restConfigProvider
	// dynamicClient is used in tests to inject a fake client. In production it is nil and
	// getDynamicClient creates a real client from restConfigProvider on each call.
	dynamicClient  dynamic.Interface
	userService    user.Service
	actionResolver ac.ActionResolver
	log            log.Logger
}

// newK8sPermissionResolver creates a new K8s permission resolver.
// Returns nil if restConfigProvider is nil (K8s APIs not available).
func newK8sPermissionResolver(
	restConfigProvider restConfigProvider,
	userService user.Service,
	actionResolver ac.ActionResolver,
) *k8sPermissionResolver {
	if restConfigProvider == nil {
		return nil
	}
	return &k8sPermissionResolver{
		restConfigProvider: restConfigProvider,
		userService:        userService,
		actionResolver:     actionResolver,
		log:                log.New("accesscontrol.k8s_resolver"),
	}
}

func (r *k8sPermissionResolver) getDynamicClient(c *contextmodel.ReqContext) (dynamic.Interface, error) {
	if r.dynamicClient != nil {
		return r.dynamicClient, nil
	}
	restConfig := r.getRestConfig(c)
	if restConfig == nil {
		return nil, fmt.Errorf("rest config not available")
	}
	return dynamic.NewForConfig(restConfig)
}

func (r *k8sPermissionResolver) getRestConfig(c *contextmodel.ReqContext) *rest.Config {
	if r.restConfigProvider == nil {
		return nil
	}
	return r.restConfigProvider.GetDirectRestConfig(c)
}

// SearchUsersPermissions returns all users' permissions by querying K8s IAM APIs.
// This mirrors the behaviour of Service.SearchUsersPermissions but uses K8s APIs instead of SQL.
func (r *k8sPermissionResolver) SearchUsersPermissions(
	ctx context.Context,
	namespace string,
	c *contextmodel.ReqContext,
	options ac.SearchOptions,
) (map[int64][]ac.Permission, error) {
	if r.restConfigProvider == nil && r.dynamicClient == nil {
		return nil, fmt.Errorf("rest config provider not available")
	}

	// Resolve action sets if an action resolver is available.
	if r.actionResolver != nil {
		options.ActionSets = r.actionResolver.ResolveAction(options.Action)
		options.ActionSets = append(options.ActionSets, r.actionResolver.ResolveActionPrefix(options.ActionPrefix)...)
	}

	if options.UserID > 0 {
		return r.searchSingleUserPermissions(ctx, namespace, c, options.UserID, options)
	}

	result, err := r.searchAllUsersPermissions(ctx, namespace, c, options)
	if err != nil {
		return nil, err
	}

	// Expand action sets in the result if needed.
	if r.actionResolver != nil && len(options.ActionSets) > 0 {
		for id, perms := range result {
			result[id] = r.actionResolver.ExpandActionSetsWithFilter(perms, ac.GetActionFilter(options))
		}
	}

	return result, nil
}

func (r *k8sPermissionResolver) searchSingleUserPermissions(
	ctx context.Context,
	namespace string,
	c *contextmodel.ReqContext,
	userID int64,
	options ac.SearchOptions,
) (map[int64][]ac.Permission, error) {
	if r.userService == nil {
		return nil, fmt.Errorf("user service not available")
	}

	u, err := r.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	dynClient, err := r.getDynamicClient(c)
	if err != nil {
		return nil, err
	}

	roleCache := make(map[string][]ac.Permission)
	perms, err := r.getUserPermissions(ctx, dynClient, namespace, u.UID, c, options, roleCache)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	return map[int64][]ac.Permission{userID: perms}, nil
}

func (r *k8sPermissionResolver) searchAllUsersPermissions(
	ctx context.Context,
	namespace string,
	c *contextmodel.ReqContext,
	options ac.SearchOptions,
) (map[int64][]ac.Permission, error) {
	dynClient, err := r.getDynamicClient(c)
	if err != nil {
		return nil, err
	}

	users, err := r.listAllUsers(ctx, dynClient, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	roleBindings, err := r.listAllRoleBindings(ctx, dynClient, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to list role bindings: %w", err)
	}

	// Build subject→roleRefs index from all role bindings.
	subjectRoles := make(map[string][]iamv0.RoleBindingspecRoleRef)
	for _, binding := range roleBindings {
		key := fmt.Sprintf("%s:%s", binding.Spec.Subject.Kind, binding.Spec.Subject.Name)
		subjectRoles[key] = append(subjectRoles[key], binding.Spec.RoleRefs...)
	}

	// Shared cache for role permissions to avoid duplicate K8s calls.
	roleCache := make(map[string][]ac.Permission)
	result := make(map[int64][]ac.Permission)

	for _, userObj := range users {
		userUID := userObj.GetName()
		userKey := fmt.Sprintf("%s:%s", iamv0.RoleBindingSpecSubjectKindUser, userUID)

		perms, err := r.buildUserPermissions(ctx, dynClient, namespace, userObj, userKey, subjectRoles, roleCache, c, options)
		if err != nil {
			r.log.Warn("Failed to build permissions for user", "uid", userUID, "error", err)
			continue
		}

		if len(perms) > 0 {
			userID := r.getUserIDFromUID(ctx, userUID)
			if userID > 0 {
				result[userID] = perms
			}
		}
	}

	return result, nil
}

// listAllUsers fetches every user in the namespace, following K8s pagination tokens.
func (r *k8sPermissionResolver) listAllUsers(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
) ([]*iamv0.User, error) {
	resource := dynClient.Resource(iamv0.UserResourceInfo.GroupVersionResource()).Namespace(namespace)
	var items []*iamv0.User
	continueToken := ""
	for {
		list, err := resource.List(ctx, metav1.ListOptions{Continue: continueToken})
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			var u iamv0.User
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[i].Object, &u); err != nil {
				r.log.Warn("Failed to parse user object", "error", err)
				continue
			}
			items = append(items, &u)
		}
		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}
	return items, nil
}

// listAllRoleBindings fetches every role binding in the namespace, following K8s pagination tokens.
func (r *k8sPermissionResolver) listAllRoleBindings(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
) ([]iamv0.RoleBinding, error) {
	resource := dynClient.Resource(iamv0.RoleBindingInfo.GroupVersionResource()).Namespace(namespace)
	var bindings []iamv0.RoleBinding
	continueToken := ""
	for {
		list, err := resource.List(ctx, metav1.ListOptions{Continue: continueToken})
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			var binding iamv0.RoleBinding
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[i].Object, &binding); err != nil {
				r.log.Warn("Failed to parse role binding", "error", err)
				continue
			}
			bindings = append(bindings, binding)
		}
		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}
	return bindings, nil
}

// getUserPermissions returns the full permission list for a single user identified by their Grafana UID.
func (r *k8sPermissionResolver) getUserPermissions(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
	userUID string,
	c *contextmodel.ReqContext,
	options ac.SearchOptions,
	roleCache map[string][]ac.Permission,
) ([]ac.Permission, error) {
	var perms []ac.Permission

	// Permissions from the user's explicit role binding.
	bindingName := fmt.Sprintf("user-%s", userUID)
	bindingResource := dynClient.Resource(iamv0.RoleBindingInfo.GroupVersionResource()).Namespace(namespace)
	if bindingObj, err := bindingResource.Get(ctx, bindingName, metav1.GetOptions{}); err == nil {
		var binding iamv0.RoleBinding
		if convErr := runtime.DefaultUnstructuredConverter.FromUnstructured(bindingObj.Object, &binding); convErr == nil {
			for _, roleRef := range binding.Spec.RoleRefs {
				rolePerms, err := r.getRolePermissions(ctx, dynClient, namespace, roleRef.Name, string(roleRef.Kind), roleCache)
				if err != nil {
					r.log.Warn("Failed to get role permissions", "role", roleRef.Name, "error", err)
					continue
				}
				perms = append(perms, rolePerms...)
			}
		}
	}

	// Permissions from the user's basic org role (Viewer / Editor / Admin).
	userResource := dynClient.Resource(iamv0.UserResourceInfo.GroupVersionResource()).Namespace(namespace)
	if userObj, err := userResource.Get(ctx, userUID, metav1.GetOptions{}); err == nil {
		var u iamv0.User
		if convErr := runtime.DefaultUnstructuredConverter.FromUnstructured(userObj.Object, &u); convErr == nil && u.Spec.Role != "" {
			basicPerms, err := r.getBasicRolePermissions(ctx, dynClient, namespace, u.Spec.Role, roleCache)
			if err == nil {
				perms = append(perms, basicPerms...)
			}
		}
	}

	// Direct resource permissions (e.g. folder/dashboard-level grants).
	directPerms, _ := r.getDirectResourcePermissions(c, namespace, userUID)
	perms = append(perms, directPerms...)

	return r.filterPermissions(perms, options), nil
}

// buildUserPermissions builds the filtered permission list for a user during a multi-user scan.
// It reuses the shared roleCache to avoid redundant K8s calls for the same role.
func (r *k8sPermissionResolver) buildUserPermissions(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
	userObj *iamv0.User,
	userKey string,
	subjectRoles map[string][]iamv0.RoleBindingspecRoleRef,
	roleCache map[string][]ac.Permission,
	c *contextmodel.ReqContext,
	options ac.SearchOptions,
) ([]ac.Permission, error) {
	var perms []ac.Permission

	// Permissions from explicitly assigned roles.
	for _, roleRef := range subjectRoles[userKey] {
		rolePerms, err := r.getRolePermissions(ctx, dynClient, namespace, roleRef.Name, string(roleRef.Kind), roleCache)
		if err != nil {
			r.log.Warn("Failed to get role permissions", "role", roleRef.Name, "error", err)
			continue
		}
		perms = append(perms, rolePerms...)
	}

	// Permissions from the basic org role (also cached).
	if userObj.Spec.Role != "" {
		basicPerms, err := r.getBasicRolePermissions(ctx, dynClient, namespace, userObj.Spec.Role, roleCache)
		if err == nil {
			perms = append(perms, basicPerms...)
		}
	}

	// Direct resource permissions.
	userUID := userObj.GetName()
	directPerms, _ := r.getDirectResourcePermissions(c, namespace, userUID)
	perms = append(perms, directPerms...)

	return r.filterPermissions(perms, options), nil
}

// getRolePermissions fetches permissions for a named role. Results are cached by "kind:name".
func (r *k8sPermissionResolver) getRolePermissions(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
	roleName string,
	roleKind string,
	roleCache map[string][]ac.Permission,
) ([]ac.Permission, error) {
	cacheKey := fmt.Sprintf("%s:%s", roleKind, roleName)
	if cached, ok := roleCache[cacheKey]; ok {
		return cached, nil
	}

	var perms []ac.Permission

	switch roleKind {
	case string(iamv0.RoleBindingSpecRoleRefKindRole):
		obj, err := dynClient.Resource(iamv0.RoleInfo.GroupVersionResource()).Namespace(namespace).Get(ctx, roleName, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		var role iamv0.Role
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &role); err != nil {
			return nil, err
		}
		for _, p := range role.Spec.Permissions {
			perms = append(perms, ac.Permission{Action: p.Action, Scope: p.Scope})
		}

	case string(iamv0.RoleBindingSpecRoleRefKindGlobalRole):
		obj, err := dynClient.Resource(iamv0.GlobalRoleInfo.GroupVersionResource()).Get(ctx, roleName, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		var globalRole iamv0.GlobalRole
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &globalRole); err != nil {
			return nil, err
		}
		for _, p := range globalRole.Spec.Permissions {
			perms = append(perms, ac.Permission{Action: p.Action, Scope: p.Scope})
		}

	default:
		return nil, fmt.Errorf("unknown role kind: %s", roleKind)
	}

	roleCache[cacheKey] = perms
	return perms, nil
}

// getBasicRolePermissions fetches permissions for the GlobalRole that corresponds to an org role
// (e.g. "Viewer" → "basic_viewer"). Results are cached via roleCache.
func (r *k8sPermissionResolver) getBasicRolePermissions(
	ctx context.Context,
	dynClient dynamic.Interface,
	namespace string,
	orgRole string,
	roleCache map[string][]ac.Permission,
) ([]ac.Permission, error) {
	basicRoleName := fmt.Sprintf("basic_%s", strings.ToLower(orgRole))
	return r.getRolePermissions(ctx, dynClient, namespace, basicRoleName, string(iamv0.RoleBindingSpecRoleRefKindGlobalRole), roleCache)
}

// getDirectResourcePermissions fetches direct resource permissions (folder/dashboard-level grants)
// via the resourcepermissions/search subresource. Returns empty without error when the rest
// config provider is not available or the subresource is unreachable.
func (r *k8sPermissionResolver) getDirectResourcePermissions(
	c *contextmodel.ReqContext,
	namespace string,
	userUID string,
) ([]ac.Permission, error) {
	if userUID == "" {
		return nil, nil
	}
	if c == nil || c.Context == nil || c.Req == nil {
		if r.log != nil {
			r.log.Debug("Skipping direct resource permissions: request context unavailable", "namespace", namespace, "userUID", userUID)
		}
		return nil, nil
	}

	restConfig := r.getRestConfig(c)
	if restConfig == nil {
		if r.log != nil {
			r.log.Debug("Skipping direct resource permissions: rest config unavailable", "namespace", namespace, "userUID", userUID)
		}
		return nil, nil
	}

	cfg := dynamic.ConfigFor(restConfig)
	cfg.GroupVersion = &iamv0.SchemeGroupVersion
	client, err := rest.RESTClientFor(cfg)
	if err != nil {
		if r.log != nil {
			r.log.Debug("Skipping direct resource permissions: could not build REST client", "namespace", namespace, "userUID", userUID, "error", err)
		}
		return nil, nil
	}

	raw, err := client.Get().
		AbsPath("apis", iamv0.GROUP, iamv0.VERSION, "namespaces", namespace, "resourcepermissions", "search").
		Param("userUID", userUID).
		Do(c.Req.Context()).
		Raw()
	if err != nil {
		if r.log != nil {
			r.log.Debug("Skipping direct resource permissions: subresource call failed", "namespace", namespace, "userUID", userUID, "error", err)
		}
		return nil, nil
	}

	var result iamv0.PermissionsSearchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		if r.log != nil {
			r.log.Debug("Skipping direct resource permissions: invalid response payload", "namespace", namespace, "userUID", userUID, "error", err)
		}
		return nil, nil
	}

	perms := make([]ac.Permission, 0, len(result.Permissions))
	for _, p := range result.Permissions {
		perms = append(perms, ac.Permission{Action: p.Action, Scope: p.Scope})
	}
	return perms, nil
}

// getUserIDFromUID converts a Grafana user UID to its numeric ID via the user service.
func (r *k8sPermissionResolver) getUserIDFromUID(ctx context.Context, uid string) int64 {
	if r.userService == nil {
		if r.log != nil {
			r.log.Warn("user service not available for UID lookup", "uid", uid)
		}
		return 0
	}

	u, err := r.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: uid})
	if err != nil {
		if r.log != nil {
			r.log.Debug("Failed to get user by UID", "uid", uid, "error", err)
		}
		return 0
	}

	return u.ID
}

// filterPermissions applies SearchOptions filters (action, actionPrefix, scope) to a permission list.
func (r *k8sPermissionResolver) filterPermissions(perms []ac.Permission, options ac.SearchOptions) []ac.Permission {
	if options.Action == "" && options.ActionPrefix == "" && options.Scope == "" {
		return perms
	}

	var filtered []ac.Permission
	for _, p := range perms {
		if options.Action != "" && p.Action != options.Action {
			continue
		}
		if options.ActionPrefix != "" && !strings.HasPrefix(p.Action, options.ActionPrefix) {
			continue
		}
		if options.Scope != "" && p.Scope != options.Scope {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered
}
