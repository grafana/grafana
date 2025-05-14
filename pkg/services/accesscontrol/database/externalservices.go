package database

import (
	"context"

	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func extServiceRoleName(externalServiceID string) string {
	name := fmt.Sprintf("%s%s:permissions", accesscontrol.ExternalServiceRolePrefix, externalServiceID)
	return name
}

func (s *AccessControlStore) DeleteExternalServiceRole(ctx context.Context, externalServiceID string) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.DeleteExternalServiceRole")
	defer span.End()

	uid := accesscontrol.PrefixedRoleUID(extServiceRoleName(externalServiceID))
	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		stored, errGet := getRoleByUID(ctx, sess, uid)
		if errGet != nil {
			// Role not found, nothing to do
			if errors.Is(errGet, accesscontrol.ErrRoleNotFound) {
				return nil
			}
			return errGet
		}

		// Delete the assignments
		_, errDel := sess.Exec("DELETE FROM user_role WHERE role_id = ?", stored.ID)
		if errDel != nil {
			return errDel
		}
		// Shouldn't happen but just in case delete any team assignments
		_, errDel = sess.Exec("DELETE FROM team_role WHERE role_id = ?", stored.ID)
		if errDel != nil {
			return errDel
		}

		// Delete the permissions
		_, errDel = sess.Exec("DELETE FROM permission WHERE role_id = ?", stored.ID)
		if errDel != nil {
			return errDel
		}

		// Delete the role
		_, errDel = sess.Exec("DELETE FROM role WHERE id = ?", stored.ID)
		return errDel
	})
}

func (s *AccessControlStore) SaveExternalServiceRole(ctx context.Context, cmd accesscontrol.SaveExternalServiceRoleCommand) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.SaveExternalServiceRole")
	defer span.End()

	role := genExternalServiceRole(cmd)
	assignment := genExternalServiceAssignment(cmd)

	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Create or update the role
		existingRole, errSaveRole := s.saveRole(ctx, sess, &role)
		if errSaveRole != nil {
			return errSaveRole
		}
		// Assign role to service account
		// We update the assignment before the permissions to avoid an edge case.
		// If the role is assigned to another service account (which can only happen if the services have the same ID)
		// and permissions are updated before the assignment, this would result in the other service account acquiring
		// a different set of permissions.
		assignment.RoleID = existingRole.ID
		errSaveAssign := s.saveUserAssignment(ctx, sess, assignment)
		if errSaveAssign != nil {
			return errSaveAssign
		}
		// Update permissions
		return s.savePermissions(ctx, sess, existingRole.ID, cmd.Permissions)
	})
}

func genExternalServiceRole(cmd accesscontrol.SaveExternalServiceRoleCommand) accesscontrol.Role {
	name := extServiceRoleName(cmd.ExternalServiceID)
	role := accesscontrol.Role{
		OrgID:       accesscontrol.GlobalOrgID, // External Service Roles are global
		Version:     1,
		Name:        name,
		UID:         accesscontrol.PrefixedRoleUID(name),
		DisplayName: fmt.Sprintf("External Service %s Permissions", cmd.ExternalServiceID),
		Description: fmt.Sprintf("External Service %s permissions", cmd.ExternalServiceID),
		Group:       "External Service",
		Hidden:      true,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
	return role
}

func genExternalServiceAssignment(cmd accesscontrol.SaveExternalServiceRoleCommand) accesscontrol.UserRole {
	assignment := accesscontrol.UserRole{
		OrgID:   cmd.AssignmentOrgID,
		UserID:  cmd.ServiceAccountID,
		Created: time.Now(),
	}
	return assignment
}

func getRoleByUID(ctx context.Context, sess *db.Session, uid string) (*accesscontrol.Role, error) {
	_, span := tracer.Start(ctx, "accesscontrol.database.getRoleByUID")
	defer span.End()

	var role accesscontrol.Role
	has, err := sess.Where("uid = ?", uid).Get(&role)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, accesscontrol.ErrRoleNotFound
	}
	return &role, nil
}

func getRoleAssignments(ctx context.Context, sess *db.Session, roleID int64) ([]accesscontrol.UserRole, error) {
	_, span := tracer.Start(ctx, "accesscontrol.database.GgetRoleAssignments")
	defer span.End()

	var assignements []accesscontrol.UserRole
	if err := sess.Where("role_id = ?", roleID).Find(&assignements); err != nil {
		return nil, err
	}
	return assignements, nil
}

func getRolePermissions(ctx context.Context, sess *db.Session, id int64) ([]accesscontrol.Permission, error) {
	_, span := tracer.Start(ctx, "accesscontrol.database.getRolePermissions")
	defer span.End()

	var permissions []accesscontrol.Permission
	if err := sess.Where("role_id = ?", id).Find(&permissions); err != nil {
		return nil, err
	}
	return permissions, nil
}

func permissionDiff(previous, new []accesscontrol.Permission) (added, removed []accesscontrol.Permission) {
	type key struct{ Action, Scope string }
	prevMap := map[key]int64{}
	for i := range previous {
		prevMap[key{previous[i].Action, previous[i].Scope}] = previous[i].ID
	}
	newMap := map[key]int64{}
	for i := range new {
		newMap[key{new[i].Action, new[i].Scope}] = 0
	}
	for i := range new {
		key := key{new[i].Action, new[i].Scope}
		if _, already := prevMap[key]; !already {
			added = append(added, new[i])
		} else {
			delete(prevMap, key)
		}
	}

	for p, id := range prevMap {
		removed = append(removed, accesscontrol.Permission{ID: id, Action: p.Action, Scope: p.Scope})
	}

	return added, removed
}

func (*AccessControlStore) saveRole(ctx context.Context, sess *db.Session, role *accesscontrol.Role) (*accesscontrol.Role, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.saveRole")
	defer span.End()

	existingRole, err := getRoleByUID(ctx, sess, role.UID)
	if err != nil && !errors.Is(err, accesscontrol.ErrRoleNotFound) {
		return nil, err
	}

	if existingRole == nil {
		if _, err := sess.Insert(role); err != nil {
			return nil, err
		}
	} else {
		role.ID = existingRole.ID
		role.Created = existingRole.Created
		if _, err := sess.Where("id = ?", existingRole.ID).MustCols("org_id").Update(role); err != nil {
			return nil, err
		}
	}
	return getRoleByUID(ctx, sess, role.UID)
}

func (*AccessControlStore) savePermissions(ctx context.Context, sess *db.Session, roleID int64, permissions []accesscontrol.Permission) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.savePermissions")
	defer span.End()

	now := time.Now()
	storedPermissions, err := getRolePermissions(ctx, sess, roleID)
	if err != nil {
		return err
	}
	added, removed := permissionDiff(storedPermissions, permissions)
	if len(added) > 0 {
		for i := range added {
			added[i].RoleID = roleID
			added[i].Created = now
			added[i].Updated = now
		}
		if _, err := sess.Insert(&added); err != nil {
			return err
		}
	}
	if len(removed) > 0 {
		ids := make([]int64, len(removed))
		for i := range removed {
			ids[i] = removed[i].ID
		}
		count, err := sess.In("id", ids).Delete(&accesscontrol.Permission{})
		if err != nil {
			return err
		}
		if count != int64(len(removed)) {
			return errors.New("failed to delete permissions that have been removed from role")
		}
	}
	return nil
}

func (*AccessControlStore) saveUserAssignment(ctx context.Context, sess *db.Session, assignment accesscontrol.UserRole) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.saveUserAssignment")
	defer span.End()

	// alreadyAssigned checks if the assignment already exists without accounting for the organization
	assignments, errGetAssigns := getRoleAssignments(ctx, sess, assignment.RoleID)
	if errGetAssigns != nil {
		return errGetAssigns
	}

	// Revoke assignment if it's assigned to another user or service account
	if len(assignments) > 0 && assignments[0].UserID != assignment.UserID {
		if _, errDel := sess.Where("role_id = ?", assignment.RoleID).Delete(&accesscontrol.UserRole{}); errDel != nil {
			return errDel
		}
		assignments = nil
	}

	// If no assignment exists, insert a new one.
	if len(assignments) == 0 {
		if _, errInsert := sess.Insert(&assignment); errInsert != nil {
			return errInsert
		}
		return nil
	}

	// Ensure the assignment is in the correct organization
	_, errUpdate := sess.Where("role_id = ? AND user_id = ?", assignment.RoleID, assignment.UserID).MustCols("org_id").Update(&assignment)
	return errUpdate
}
