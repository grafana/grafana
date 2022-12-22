package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var (
	batchSize = 500
)

type permissionMigrator struct {
	sess    *xorm.Session
	dialect migrator.Dialect
	migrator.MigrationBase
}

func (m *permissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *permissionMigrator) findRole(orgID int64, name string) (accesscontrol.Role, error) {
	// check if role exists
	var role accesscontrol.Role
	_, err := m.sess.Table("role").Where("org_id = ? AND name = ?", orgID, name).Get(&role)
	return role, err
}

func (m *permissionMigrator) bulkCreateRoles(allRoles []*accesscontrol.Role) ([]*accesscontrol.Role, error) {
	if len(allRoles) == 0 {
		return nil, nil
	}

	allCreatedRoles := make([]*accesscontrol.Role, 0, len(allRoles))

	createRoles := m.createRoles
	if m.dialect.DriverName() == migrator.MySQL {
		createRoles = m.createRolesMySQL
	}

	// bulk role creations
	err := batch(len(allRoles), batchSize, func(start, end int) error {
		roles := allRoles[start:end]
		createdRoles, err := createRoles(roles)
		if err != nil {
			return err
		}
		allCreatedRoles = append(allCreatedRoles, createdRoles...)
		return nil
	})

	return allCreatedRoles, err
}

func (m *permissionMigrator) bulkAssignRoles(allRoles []*accesscontrol.Role) error {
	if len(allRoles) == 0 {
		return nil
	}

	ts := time.Now()
	userRoleAssignments := make([]accesscontrol.UserRole, 0)
	teamRoleAssignments := make([]accesscontrol.TeamRole, 0)
	builtInRoleAssignments := make([]accesscontrol.BuiltinRole, 0)

	for _, role := range allRoles {
		if strings.HasPrefix(role.Name, "managed:users") {
			userID, err := strconv.ParseInt(strings.Split(role.Name, ":")[2], 10, 64)
			if err != nil {
				return err
			}
			userRoleAssignments = append(userRoleAssignments, accesscontrol.UserRole{
				OrgID:   role.OrgID,
				RoleID:  role.ID,
				UserID:  userID,
				Created: ts,
			})
		} else if strings.HasPrefix(role.Name, "managed:teams") {
			teamID, err := strconv.ParseInt(strings.Split(role.Name, ":")[2], 10, 64)
			if err != nil {
				return err
			}
			teamRoleAssignments = append(teamRoleAssignments, accesscontrol.TeamRole{
				OrgID:   role.OrgID,
				RoleID:  role.ID,
				TeamID:  teamID,
				Created: ts,
			})
		} else if strings.HasPrefix(role.Name, "managed:builtins") {
			builtIn := strings.Title(strings.Split(role.Name, ":")[2])
			builtInRoleAssignments = append(builtInRoleAssignments, accesscontrol.BuiltinRole{
				OrgID:   role.OrgID,
				RoleID:  role.ID,
				Role:    builtIn,
				Created: ts,
				Updated: ts,
			})
		}
	}

	err := batch(len(userRoleAssignments), batchSize, func(start, end int) error {
		_, err := m.sess.Table("user_role").InsertMulti(userRoleAssignments[start:end])
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to create user role assignments: %w", err)
	}

	err = batch(len(teamRoleAssignments), batchSize, func(start, end int) error {
		_, err := m.sess.Table("team_role").InsertMulti(teamRoleAssignments[start:end])
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to create team role assignments: %w", err)
	}

	return batch(len(builtInRoleAssignments), batchSize, func(start, end int) error {
		if _, err := m.sess.Table("builtin_role").InsertMulti(builtInRoleAssignments[start:end]); err != nil {
			return fmt.Errorf("failed to create builtin role assignments: %w", err)
		}
		return nil
	})
}

// createRoles creates a list of roles and returns their id, orgID, name in a single query
func (m *permissionMigrator) createRoles(roles []*accesscontrol.Role) ([]*accesscontrol.Role, error) {
	ts := time.Now()
	createdRoles := make([]*accesscontrol.Role, 0, len(roles))
	valueStrings := make([]string, len(roles))
	args := make([]interface{}, 0, len(roles)*5)

	for i, r := range roles {
		uid, err := GenerateManagedRoleUID(r.OrgID, r.Name)
		if err != nil {
			return nil, err
		}
		valueStrings[i] = "(?, ?, ?, 1, ?, ?)"
		args = append(args, r.OrgID, uid, r.Name, ts, ts)
	}

	// Insert and fetch at once
	valueString := strings.Join(valueStrings, ",")
	sql := fmt.Sprintf("INSERT INTO role (org_id, uid, name, version, created, updated) VALUES %s RETURNING id, org_id, name", valueString)
	if errCreate := m.sess.SQL(sql, args...).Find(&createdRoles); errCreate != nil {
		return nil, fmt.Errorf("failed to create roles: %w", errCreate)
	}

	return createdRoles, nil
}

// createRolesMySQL creates a list of roles then fetches them
func (m *permissionMigrator) createRolesMySQL(roles []*accesscontrol.Role) ([]*accesscontrol.Role, error) {
	ts := time.Now()
	createdRoles := make([]*accesscontrol.Role, 0, len(roles))

	where := make([]string, len(roles))
	args := make([]interface{}, 0, len(roles)*2)

	for i := range roles {
		uid, err := GenerateManagedRoleUID(roles[i].OrgID, roles[i].Name)
		if err != nil {
			return nil, err
		}
		roles[i].UID = uid
		roles[i].Created = ts
		roles[i].Updated = ts

		where[i] = ("(org_id = ? AND uid = ?)")
		args = append(args, roles[i].OrgID, uid)
	}

	// Insert roles
	if _, errCreate := m.sess.Table("role").Insert(&roles); errCreate != nil {
		return nil, errCreate
	}

	// Fetch newly created roles
	if errFindInsertions := m.sess.Table("role").
		Where(strings.Join(where, " OR "), args...).
		Find(&createdRoles); errFindInsertions != nil {
		return nil, errFindInsertions
	}

	return createdRoles, nil
}

func batch(count, batchSize int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}

// GenerateManagedRoleUID generated a deterministic uid of the form `managed_{org_id}_{type}_{id}`.
func GenerateManagedRoleUID(orgID int64, name string) (string, error) {
	parts := strings.Split(name, ":")
	if len(parts) != 4 {
		return "", fmt.Errorf("unexpected role name: %s", name)
	}
	return fmt.Sprintf("managed_%d_%s_%s", orgID, parts[1], parts[2]), nil
}
