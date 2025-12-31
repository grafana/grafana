package seeding

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

type Seeder struct {
	log                 log.Logger
	roleStore           accesscontrol.RoleStore
	backend             SeedingBackend
	builtinsPermissions map[accesscontrol.SeedPermission]struct{}
	seededFixedRoles    map[string]bool
	seededPluginRoles   map[string]bool
	seededPlugins       map[string]bool
	hasSeededAlready    bool
}

// SeedingBackend provides the seed-set specific operations needed to seed.
type SeedingBackend interface {
	// LoadPrevious returns the currently stored permissions for previously seeded roles.
	LoadPrevious(ctx context.Context) (map[accesscontrol.SeedPermission]struct{}, error)

	// Apply updates the database to match the desired permissions.
	Apply(ctx context.Context,
		added, removed []accesscontrol.SeedPermission,
		updated map[accesscontrol.SeedPermission]accesscontrol.SeedPermission,
	) error
}

func New(log log.Logger, roleStore accesscontrol.RoleStore, backend SeedingBackend) *Seeder {
	return &Seeder{
		log:                 log,
		roleStore:           roleStore,
		backend:             backend,
		builtinsPermissions: map[accesscontrol.SeedPermission]struct{}{},
		seededFixedRoles:    map[string]bool{},
		seededPluginRoles:   map[string]bool{},
		seededPlugins:       map[string]bool{},
		hasSeededAlready:    false,
	}
}

// SetDesiredPermissions replaces the in-memory desired permission set used by Seed().
func (s *Seeder) SetDesiredPermissions(desired map[accesscontrol.SeedPermission]struct{}) {
	if desired == nil {
		s.builtinsPermissions = map[accesscontrol.SeedPermission]struct{}{}
		return
	}
	s.builtinsPermissions = desired
}

// Seed loads current and desired permissions, diffs them (including scope updates), applies changes, and bumps versions.
func (s *Seeder) Seed(ctx context.Context) error {
	previous, err := s.backend.LoadPrevious(ctx)
	if err != nil {
		return err
	}

	// - Do not remove plugin permissions when the plugin didn't register this run (Origin set but not in seededPlugins).
	// - Preserve legacy plugin app access permissions in the persisted seed set (these are granted by default).
	if len(previous) > 0 {
		filtered := make(map[accesscontrol.SeedPermission]struct{}, len(previous))
		for p := range previous {
			if p.Action == pluginaccesscontrol.ActionAppAccess {
				continue
			}
			if p.Origin != "" && !s.seededPlugins[p.Origin] {
				continue
			}
			filtered[p] = struct{}{}
		}
		previous = filtered
	}

	added, removed, updated := s.permissionDiff(previous, s.builtinsPermissions)

	if err := s.backend.Apply(ctx, added, removed, updated); err != nil {
		return err
	}
	return nil
}

// SeedRoles populates the database with the roles and their assignments
// It will create roles that do not exist and update roles that have changed
// Do not use for provisioning. Validation is not enforced.
func (s *Seeder) SeedRoles(ctx context.Context, registrationList []accesscontrol.RoleRegistration) error {
	roleMap, err := s.roleStore.LoadRoles(ctx)
	if err != nil {
		return err
	}

	missingRoles := make([]accesscontrol.RoleRegistration, 0, len(registrationList))

	// Diff existing roles with the ones we want to seed.
	// If a role is missing, we add it to the missingRoles list
	for _, registration := range registrationList {
		registration := registration
		role, ok := roleMap[registration.Role.Name]
		switch {
		case registration.Role.IsFixed():
			s.seededFixedRoles[registration.Role.Name] = true
		case registration.Role.IsPlugin():
			s.seededPluginRoles[registration.Role.Name] = true
			// To be resilient to failed plugin loadings, we remember the plugins that have registered,
			// later we'll ignore permissions and roles of other plugins
			s.seededPlugins[pluginutils.PluginIDFromName(registration.Role.Name)] = true
		}

		s.rememberPermissionAssignments(&registration.Role, registration.Grants, registration.Exclude)

		if !ok {
			missingRoles = append(missingRoles, registration)
			continue
		}

		if needsRoleUpdate(role, registration.Role) {
			if err := s.roleStore.SetRole(ctx, role, registration.Role); err != nil {
				return err
			}
		}

		if needsPermissionsUpdate(role, registration.Role) {
			if err := s.roleStore.SetPermissions(ctx, role, registration.Role); err != nil {
				return err
			}
		}
	}

	for _, registration := range missingRoles {
		if err := s.roleStore.CreateRole(ctx, registration.Role); err != nil {
			return err
		}
	}

	return nil
}

func needsPermissionsUpdate(existingRole *accesscontrol.RoleDTO, wantedRole accesscontrol.RoleDTO) bool {
	if existingRole == nil {
		return true
	}

	if len(existingRole.Permissions) != len(wantedRole.Permissions) {
		return true
	}

	for _, p := range wantedRole.Permissions {
		found := false
		for _, ep := range existingRole.Permissions {
			if ep.Action == p.Action && ep.Scope == p.Scope {
				found = true
				break
			}
		}
		if !found {
			return true
		}
	}

	return false
}

func needsRoleUpdate(existingRole *accesscontrol.RoleDTO, wantedRole accesscontrol.RoleDTO) bool {
	if existingRole == nil {
		return true
	}

	if existingRole.Name != wantedRole.Name {
		return false
	}

	if existingRole.DisplayName != wantedRole.DisplayName {
		return true
	}

	if existingRole.Description != wantedRole.Description {
		return true
	}

	if existingRole.Group != wantedRole.Group {
		return true
	}

	if existingRole.Hidden != wantedRole.Hidden {
		return true
	}

	return false
}

// Deprecated: SeedRole is deprecated and should not be used.
// SeedRoles only does boot up seeding and should not be used for runtime seeding.
func (s *Seeder) SeedRole(ctx context.Context, role accesscontrol.RoleDTO, builtInRoles []string) error {
	addedPermissions := make(map[string]struct{}, len(role.Permissions))
	permissions := make([]accesscontrol.Permission, 0, len(role.Permissions))
	for _, p := range role.Permissions {
		key := fmt.Sprintf("%s:%s", p.Action, p.Scope)
		if _, ok := addedPermissions[key]; !ok {
			addedPermissions[key] = struct{}{}
			permissions = append(permissions, accesscontrol.Permission{Action: p.Action, Scope: p.Scope})
		}
	}

	wantedRole := accesscontrol.RoleDTO{
		OrgID:       accesscontrol.GlobalOrgID,
		Version:     role.Version,
		UID:         role.UID,
		Name:        role.Name,
		DisplayName: role.DisplayName,
		Description: role.Description,
		Group:       role.Group,
		Permissions: permissions,
		Hidden:      role.Hidden,
	}
	roleMap, err := s.roleStore.LoadRoles(ctx)
	if err != nil {
		return err
	}

	existingRole := roleMap[wantedRole.Name]
	if existingRole == nil {
		if err := s.roleStore.CreateRole(ctx, wantedRole); err != nil {
			return err
		}
	} else {
		if needsRoleUpdate(existingRole, wantedRole) {
			if err := s.roleStore.SetRole(ctx, existingRole, wantedRole); err != nil {
				return err
			}
		}
		if needsPermissionsUpdate(existingRole, wantedRole) {
			if err := s.roleStore.SetPermissions(ctx, existingRole, wantedRole); err != nil {
				return err
			}
		}
	}

	// Remember seeded roles
	if wantedRole.IsFixed() {
		s.seededFixedRoles[wantedRole.Name] = true
	}
	isPluginRole := wantedRole.IsPlugin()
	if isPluginRole {
		s.seededPluginRoles[wantedRole.Name] = true

		// To be resilient to failed plugin loadings, we remember the plugins that have registered,
		// later we'll ignore permissions and roles of other plugins
		s.seededPlugins[pluginutils.PluginIDFromName(role.Name)] = true
	}

	s.rememberPermissionAssignments(&wantedRole, builtInRoles, []string{})
	return nil
}

func (s *Seeder) rememberPermissionAssignments(role *accesscontrol.RoleDTO, builtInRoles []string, excludedRoles []string) {
	AppendDesiredPermissions(s.builtinsPermissions, s.log, role, builtInRoles, excludedRoles, true)
}

// AppendDesiredPermissions accumulates permissions from a role registration onto basic roles (Viewer/Editor/Admin/Grafana Admin).
// - It expands parents via accesscontrol.BuiltInRolesWithParents.
// - It can optionally ignore plugin app access permissions (which are granted by default).
func AppendDesiredPermissions(
	out map[accesscontrol.SeedPermission]struct{},
	logger log.Logger,
	role *accesscontrol.RoleDTO,
	builtInRoles []string,
	excludedRoles []string,
	ignorePluginAppAccess bool,
) {
	if out == nil || role == nil {
		return
	}

	for builtInRole := range accesscontrol.BuiltInRolesWithParents(builtInRoles) {
		// Skip excluded grants
		if slices.Contains(excludedRoles, builtInRole) {
			continue
		}

		for _, perm := range role.Permissions {
			if ignorePluginAppAccess && perm.Action == pluginaccesscontrol.ActionAppAccess {
				logger.Debug("Role is attempting to grant access permission, but this permission is already granted by default and will be ignored",
					"role", role.Name, "permission", perm.Action, "scope", perm.Scope)
				continue
			}

			sp := accesscontrol.SeedPermission{
				BuiltInRole: builtInRole,
				Action:      perm.Action,
				Scope:       perm.Scope,
			}

			if role.IsPlugin() {
				sp.Origin = pluginutils.PluginIDFromName(role.Name)
			}

			out[sp] = struct{}{}
		}
	}
}

// permissionDiff returns:
// - added: present in desired permissions, not in previous permissions
// - removed: present in previous permissions, not in desired permissions
// - updated: same role + action, but scope changed
func (s *Seeder) permissionDiff(previous, desired map[accesscontrol.SeedPermission]struct{}) (added, removed []accesscontrol.SeedPermission, updated map[accesscontrol.SeedPermission]accesscontrol.SeedPermission) {
	addedSet := make(map[accesscontrol.SeedPermission]struct{}, 0)
	for n := range desired {
		if _, already := previous[n]; !already {
			addedSet[n] = struct{}{}
		} else {
			delete(previous, n)
		}
	}

	// Check if any of the new permissions is actually an old permission with an updated scope
	updated = make(map[accesscontrol.SeedPermission]accesscontrol.SeedPermission, 0)
	for n := range addedSet {
		for p := range previous {
			if n.BuiltInRole == p.BuiltInRole && n.Action == p.Action {
				updated[p] = n
				delete(addedSet, n)
			}
		}
	}

	for p := range addedSet {
		added = append(added, p)
	}

	for p := range previous {
		if p.Action == pluginaccesscontrol.ActionAppAccess &&
			p.Scope != pluginaccesscontrol.ScopeProvider.GetResourceAllScope() {
			// Allows backward compatibility with plugins that have been seeded before the grant ignore rule was added
			s.log.Info("This permission already existed so it will not be removed",
				"role", p.BuiltInRole, "permission", p.Action, "scope", p.Scope)
			continue
		}

		removed = append(removed, p)
	}

	return added, removed, updated
}

func (s *Seeder) ClearBasicRolesPluginPermissions(ID string) {
	removable := []accesscontrol.SeedPermission{}

	for key := range s.builtinsPermissions {
		if matchPermissionByPluginID(key, ID) {
			removable = append(removable, key)
		}
	}

	for _, perm := range removable {
		delete(s.builtinsPermissions, perm)
	}
}

func matchPermissionByPluginID(perm accesscontrol.SeedPermission, pluginID string) bool {
	if perm.Origin != pluginID {
		return false
	}
	actionTemplate := regexp.MustCompile(fmt.Sprintf("%s[.:]", pluginID))
	scopeTemplate := fmt.Sprintf(":%s", pluginID)
	return actionTemplate.MatchString(perm.Action) || strings.HasSuffix(perm.Scope, scopeTemplate)
}

// RolesToUpgrade returns the unique basic roles that should have their version incremented.
func RolesToUpgrade(added, removed []accesscontrol.SeedPermission) []string {
	set := map[string]struct{}{}
	for _, p := range added {
		set[p.BuiltInRole] = struct{}{}
	}
	for _, p := range removed {
		set[p.BuiltInRole] = struct{}{}
	}
	out := make([]string, 0, len(set))
	for r := range set {
		out = append(out, r)
	}
	return out
}

func (s *Seeder) ClearPluginRoles(ID string) {
	expectedPrefix := fmt.Sprintf("%s%s:", accesscontrol.PluginRolePrefix, ID)

	for roleName := range s.seededPluginRoles {
		if strings.HasPrefix(roleName, expectedPrefix) {
			delete(s.seededPluginRoles, roleName)
		}
	}
}

func (s *Seeder) MarkSeededAlready() {
	s.hasSeededAlready = true
}

func (s *Seeder) HasSeededAlready() bool {
	return s.hasSeededAlready
}

func (s *Seeder) RemoveAbsentRoles(ctx context.Context) error {
	roleMap, errGet := s.roleStore.LoadRoles(ctx)
	if errGet != nil {
		s.log.Error("failed to get fixed roles from store", "err", errGet)
		return errGet
	}

	toRemove := []string{}
	for _, r := range roleMap {
		if r == nil {
			continue
		}
		if r.IsFixed() {
			if !s.seededFixedRoles[r.Name] {
				s.log.Info("role is not seeded anymore, mark it for deletion", "role", r.Name)
				toRemove = append(toRemove, r.UID)
			}
			continue
		}

		if r.IsPlugin() {
			if !s.seededPlugins[pluginutils.PluginIDFromName(r.Name)] {
				// To be resilient to failed plugin loadings
				// ignore stored roles related to plugins that have not registered this time
				s.log.Debug("plugin role has not been registered on this run skipping its removal", "role", r.Name)
				continue
			}
			if !s.seededPluginRoles[r.Name] {
				s.log.Info("role is not seeded anymore, mark it for deletion", "role", r.Name)
				toRemove = append(toRemove, r.UID)
			}
		}
	}

	if errDelete := s.roleStore.DeleteRoles(ctx, toRemove); errDelete != nil {
		s.log.Error("failed to delete absent fixed and plugin roles", "err", errDelete)
		return errDelete
	}
	return nil
}
