package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// bulkLookupChunkSize bounds the number of values bound in one IN clause.
	bulkLookupChunkSize = 500
	// bulkInsertChunkSize bounds the number of rows in one multi-row insert,
	// keeping the bound parameters under the limits of the supported databases.
	bulkInsertChunkSize = 100
)

var errInvalidBulkUserCommands = errors.New("bulk user permission commands must target distinct users on a single resource")

// SetUserResourcePermissions sets managed permissions on one resource for many
// users at once. It leaves the database in the same state as calling
// setUserResourcePermission for each command, but with a fixed number of queries
// per chunk of users instead of several per user. The hook is called once per
// distinct permission with every user set to it.
//
// All commands must target distinct users and the same resource.
func (s *store) SetUserResourcePermissions(
	ctx context.Context, orgID int64,
	commands []SetResourcePermissionsCommand,
	hook UsersResourceHookFunc,
) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetUserResourcePermissions")
	defer span.End()

	if err := validateBulkUserCommands(commands); err != nil {
		return nil, err
	}

	var permissions []accesscontrol.ResourcePermission
	err := s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var err error
		permissions, err = s.setUserResourcePermissions(sess, orgID, commands, hook)
		return err
	})

	return permissions, err
}

func validateBulkUserCommands(commands []SetResourcePermissionsCommand) error {
	if len(commands) == 0 {
		return nil
	}

	first := commands[0]
	seen := make(map[int64]struct{}, len(commands))
	for _, cmd := range commands {
		if cmd.User.ID == 0 || cmd.TeamID != 0 || cmd.BuiltinRole != "" {
			return errInvalidBulkUserCommands
		}
		if cmd.Resource != first.Resource || cmd.ResourceID != first.ResourceID || cmd.ResourceAttribute != first.ResourceAttribute {
			return errInvalidBulkUserCommands
		}
		if _, ok := seen[cmd.User.ID]; ok {
			return errInvalidBulkUserCommands
		}
		seen[cmd.User.ID] = struct{}{}
	}

	return nil
}

func (s *store) setUserResourcePermissions(
	sess *db.Session, orgID int64,
	commands []SetResourcePermissionsCommand,
	hook UsersResourceHookFunc,
) ([]accesscontrol.ResourcePermission, error) {
	if len(commands) == 0 {
		return []accesscontrol.ResourcePermission{}, nil
	}

	first := commands[0]
	scope := accesscontrol.Scope(first.Resource, first.ResourceAttribute, first.ResourceID)

	userIDs := make([]int64, 0, len(commands))
	for _, cmd := range commands {
		userIDs = append(userIDs, cmd.User.ID)
	}

	roleIDs, err := s.getOrCreateManagedUserRoles(sess, orgID, userIDs)
	if err != nil {
		return nil, err
	}

	current, err := getPermissionsForRoles(sess, slices.Collect(maps.Values(roleIDs)), scope)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var remove []int64
	var create []accesscontrol.Permission
	for _, cmd := range commands {
		roleID := roleIDs[cmd.User.ID]

		missing := make(map[string]struct{}, len(cmd.Actions))
		for _, a := range cmd.Actions {
			missing[a] = struct{}{}
		}

		for _, p := range current[roleID] {
			if _, ok := missing[p.Action]; ok {
				delete(missing, p.Action)
			} else {
				remove = append(remove, p.ID)
			}
		}

		for action := range missing {
			p := managedPermission(action, cmd.Resource, cmd.ResourceID, cmd.ResourceAttribute)
			p.RoleID = roleID
			p.Created = now
			p.Updated = now
			p.Kind, p.Attribute, p.Identifier = p.SplitScope()
			p.DatasourceType = cmd.DatasourceType
			create = append(create, p)
		}
	}

	for chunk := range slices.Chunk(remove, bulkLookupChunkSize) {
		if err := deletePermissions(sess, chunk); err != nil {
			return nil, err
		}
	}

	for chunk := range slices.Chunk(create, bulkInsertChunkSize) {
		if _, err := sess.InsertMulti(&chunk); err != nil {
			return nil, err
		}
	}

	if hook != nil {
		// Group users by permission, keeping the order in which permissions first
		// appear so hooks run in a deterministic order.
		var order []string
		byPermission := make(map[string][]accesscontrol.User)
		for _, cmd := range commands {
			if _, ok := byPermission[cmd.Permission]; !ok {
				order = append(order, cmd.Permission)
			}
			byPermission[cmd.Permission] = append(byPermission[cmd.Permission], cmd.User)
		}

		for _, permission := range order {
			if err := hook(sess, orgID, byPermission[permission], first.ResourceID, permission); err != nil {
				return nil, err
			}
		}
	}

	resulting, err := s.getPermissionsForRolesWithAssignments(sess, slices.Collect(maps.Values(roleIDs)), scope)
	if err != nil {
		return nil, err
	}

	permissions := make([]accesscontrol.ResourcePermission, 0, len(commands))
	for _, cmd := range commands {
		permission := flatPermissionsToResourcePermission(scope, resulting[cmd.User.ID])
		if permission == nil {
			permissions = append(permissions, accesscontrol.ResourcePermission{})
			continue
		}
		permissions = append(permissions, *permission)
	}

	return permissions, nil
}

// getOrCreateManagedUserRoles returns the ID of the managed role of each user,
// creating the roles and their user assignments that don't exist yet.
func (s *store) getOrCreateManagedUserRoles(sess *db.Session, orgID int64, userIDs []int64) (map[int64]int64, error) {
	userByRoleName := make(map[string]int64, len(userIDs))
	names := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		name := accesscontrol.ManagedUserRoleName(id)
		userByRoleName[name] = id
		names = append(names, name)
	}

	roleIDs := make(map[int64]int64, len(userIDs))
	existing, err := getRolesByName(sess, orgID, names)
	if err != nil {
		return nil, err
	}
	for _, r := range existing {
		roleIDs[userByRoleName[r.Name]] = r.ID
	}

	var missingNames []string
	for _, name := range names {
		if _, ok := roleIDs[userByRoleName[name]]; !ok {
			missingNames = append(missingNames, name)
		}
	}
	if len(missingNames) == 0 {
		return roleIDs, nil
	}

	uids, err := generateNewRoleUIDs(sess, orgID, len(missingNames))
	if err != nil {
		return nil, err
	}

	now := time.Now()
	roles := make([]accesscontrol.Role, 0, len(missingNames))
	for i, name := range missingNames {
		roles = append(roles, accesscontrol.Role{
			OrgID:   orgID,
			Name:    name,
			UID:     uids[i],
			Created: now,
			Updated: now,
		})
	}
	for chunk := range slices.Chunk(roles, bulkInsertChunkSize) {
		if _, err := sess.InsertMulti(&chunk); err != nil {
			return nil, err
		}
	}

	// Multi-row inserts don't report the new IDs on every database, so read them back.
	created, err := getRolesByName(sess, orgID, missingNames)
	if err != nil {
		return nil, err
	}
	if len(created) != len(missingNames) {
		return nil, fmt.Errorf("created %d managed user roles but found %d", len(missingNames), len(created))
	}

	// The roles are new, so none of them can be assigned yet.
	userRoles := make([]accesscontrol.UserRole, 0, len(created))
	for _, r := range created {
		userID := userByRoleName[r.Name]
		roleIDs[userID] = r.ID
		userRoles = append(userRoles, accesscontrol.UserRole{
			OrgID:   orgID,
			UserID:  userID,
			RoleID:  r.ID,
			Created: now,
		})
	}
	for chunk := range slices.Chunk(userRoles, bulkInsertChunkSize) {
		if _, err := sess.InsertMulti(&chunk); err != nil {
			return nil, err
		}
	}

	return roleIDs, nil
}

func getRolesByName(sess *db.Session, orgID int64, names []string) ([]accesscontrol.Role, error) {
	roles := make([]accesscontrol.Role, 0, len(names))
	for chunk := range slices.Chunk(names, bulkLookupChunkSize) {
		var found []accesscontrol.Role
		if err := sess.Where("org_id = ?", orgID).In("name", chunk).Find(&found); err != nil {
			return nil, err
		}
		roles = append(roles, found...)
	}
	return roles, nil
}

// generateNewRoleUIDs returns n distinct role UIDs that are unused in the org.
func generateNewRoleUIDs(sess *db.Session, orgID int64, n int) ([]string, error) {
	uids := make([]string, 0, n)
	seen := make(map[string]struct{}, n)

	for range 3 {
		candidates := make([]string, 0, n-len(uids))
		for len(candidates) < n-len(uids) {
			uid := util.GenerateShortUID()
			if _, ok := seen[uid]; ok {
				continue
			}
			seen[uid] = struct{}{}
			candidates = append(candidates, uid)
		}

		taken := make(map[string]struct{})
		for chunk := range slices.Chunk(candidates, bulkLookupChunkSize) {
			var found []string
			if err := sess.Table("role").Where("org_id = ?", orgID).In("uid", chunk).Cols("uid").Find(&found); err != nil {
				return nil, err
			}
			for _, uid := range found {
				taken[uid] = struct{}{}
			}
		}

		for _, uid := range candidates {
			if _, ok := taken[uid]; !ok {
				uids = append(uids, uid)
			}
		}
		if len(uids) == n {
			return uids, nil
		}
	}

	return nil, fmt.Errorf("failed to generate uid")
}

// getPermissionsForRoles returns the permissions on scope of each role, keyed by role ID.
func getPermissionsForRoles(sess *db.Session, roleIDs []int64, scope string) (map[int64][]accesscontrol.Permission, error) {
	result := make(map[int64][]accesscontrol.Permission, len(roleIDs))
	for chunk := range slices.Chunk(roleIDs, bulkLookupChunkSize) {
		rawSQL := `SELECT p.* FROM permission as p WHERE p.scope = ? AND p.role_id IN (?` + strings.Repeat(",?", len(chunk)-1) + `)`
		args := make([]any, 0, len(chunk)+1)
		args = append(args, scope)
		for _, id := range chunk {
			args = append(args, id)
		}

		var found []accesscontrol.Permission
		if err := sess.SQL(rawSQL, args...).Find(&found); err != nil {
			return nil, err
		}
		for _, p := range found {
			result[p.RoleID] = append(result[p.RoleID], p)
		}
	}
	return result, nil
}

// getPermissionsForRolesWithAssignments is the bulk form of getPermissions for
// managed user roles: it returns the permissions on scope of each role, with the
// assignment details, keyed by user ID.
func (s *store) getPermissionsForRolesWithAssignments(sess *db.Session, roleIDs []int64, scope string) (map[int64][]flatResourcePermission, error) {
	result := make(map[int64][]flatResourcePermission, len(roleIDs))
	for chunk := range slices.Chunk(roleIDs, bulkLookupChunkSize) {
		rawSQL := `
		SELECT
			p.*,
			ur.user_id AS user_id,
			u.login AS user_login,
			u.email AS user_email,
			r.name as role_name
		FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			INNER JOIN user_role ur ON r.id = ur.role_id
			LEFT JOIN ` + s.sql.GetDialect().Quote("user") + ` u ON ur.user_id = u.id
		WHERE p.scope = ? AND r.id IN (?` + strings.Repeat(",?", len(chunk)-1) + `)
		`
		args := make([]any, 0, len(chunk)+1)
		args = append(args, scope)
		for _, id := range chunk {
			args = append(args, id)
		}

		var found []flatResourcePermission
		if err := sess.SQL(rawSQL, args...).Find(&found); err != nil {
			return nil, err
		}
		for _, p := range found {
			result[p.UserId] = append(result[p.UserId], p)
		}
	}
	return result, nil
}
