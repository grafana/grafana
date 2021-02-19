package rbac

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ac *RBACService) GetPolicies(ctx context.Context, orgID int64) ([]*Policy, error) {
	var result []*Policy
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policies := make([]*Policy, 0)
		q := "SELECT id, uid, org_id, name, description, updated FROM policy WHERE org_id = ?"
		if err := sess.SQL(q, orgID).Find(&policies); err != nil {
			return err
		}

		result = policies
		return nil
	})
	return result, err
}

func (ac *RBACService) GetPolicy(ctx context.Context, orgID, policyID int64) (*PolicyDTO, error) {
	var result *PolicyDTO

	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		policy, err := getPolicyById(sess, policyID, orgID)
		if err != nil {
			return err
		}

		permissions, err := getPolicyPermissions(sess, policyID)
		if err != nil {
			return err
		}

		policy.Permissions = permissions
		result = policy
		return nil
	})

	return result, err
}

func (ac *RBACService) GetPolicyByUID(ctx context.Context, orgId int64, uid string) (*PolicyDTO, error) {
	var result *PolicyDTO

	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		policy, err := getPolicyByUID(sess, uid, orgId)
		if err != nil {
			return err
		}

		permissions, err := getPolicyPermissions(sess, policy.Id)
		if err != nil {
			return err
		}

		policy.Permissions = permissions
		result = policy
		return nil
	})

	return result, err
}

func (ac *RBACService) CreatePolicy(ctx context.Context, cmd CreatePolicyCommand) (*Policy, error) {
	var result *Policy

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		policy, err := ac.createPolicy(sess, cmd)
		if err != nil {
			return err
		}

		result = policy
		return nil
	})

	return result, err
}

func (ac *RBACService) createPolicy(sess *sqlstore.DBSession, cmd CreatePolicyCommand) (*Policy, error) {
	uid, err := generateNewPolicyUID(sess, cmd.OrgId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate UID for policy %q: %w", cmd.Name, err)
	}

	policy := &Policy{
		OrgId:       cmd.OrgId,
		UID:         uid,
		Name:        cmd.Name,
		Description: cmd.Description,
		Created:     timeNow(),
		Updated:     timeNow(),
	}

	if _, err := sess.Insert(policy); err != nil {
		if ac.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "name") {
			return nil, fmt.Errorf("policy with the name '%s' already exists: %w", cmd.Name, err)
		}
		return nil, err
	}

	return policy, nil
}

func (ac *RBACService) CreatePolicyWithPermissions(ctx context.Context, cmd CreatePolicyWithPermissionsCommand) (*PolicyDTO, error) {
	var result *PolicyDTO

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		createPolicyCmd := CreatePolicyCommand{
			OrgId:       cmd.OrgId,
			Name:        cmd.Name,
			Description: cmd.Description,
		}

		policy, err := ac.createPolicy(sess, createPolicyCmd)
		if err != nil {
			return err
		}

		result = &PolicyDTO{
			Id:          policy.Id,
			UID:         policy.UID,
			OrgId:       policy.OrgId,
			Name:        policy.Name,
			Description: policy.Description,
			Created:     policy.Created,
			Updated:     policy.Updated,
		}

		// Add permissions
		for _, p := range cmd.Permissions {
			createPermissionCmd := CreatePermissionCommand{
				PolicyId:   policy.Id,
				Permission: p.Permission,
				Scope:      p.Scope,
			}

			permission, err := createPermission(sess, createPermissionCmd)
			if err != nil {
				return err
			}
			result.Permissions = append(result.Permissions, *permission)
		}

		return nil
	})

	return result, err
}

// UpdatePolicy updates policy with permissions
func (ac *RBACService) UpdatePolicy(ctx context.Context, cmd UpdatePolicyCommand) (*PolicyDTO, error) {
	var result *PolicyDTO
	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: work with both ID and UID
		existingPolicy, err := getPolicyByUID(sess, cmd.UID, cmd.OrgId)
		if err != nil {
			return err
		}

		policy := &Policy{
			Id:          existingPolicy.Id,
			UID:         existingPolicy.UID,
			OrgId:       existingPolicy.OrgId,
			Name:        cmd.Name,
			Description: cmd.Description,
			Updated:     timeNow(),
		}

		affectedRows, err := sess.ID(existingPolicy.Id).Update(policy)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return ErrPolicyNotFound
		}

		result = &PolicyDTO{
			Id:          policy.Id,
			UID:         policy.UID,
			OrgId:       policy.OrgId,
			Name:        policy.Name,
			Description: policy.Description,
			Created:     policy.Created,
			Updated:     policy.Updated,
		}

		// Delete policy's permissions
		_, err = sess.Exec("DELETE FROM permission WHERE policy_id = ?", existingPolicy.Id)
		if err != nil {
			return err
		}

		// Add permissions
		for _, p := range cmd.Permissions {
			createPermissionCmd := CreatePermissionCommand{
				PolicyId:   policy.Id,
				Permission: p.Permission,
				Scope:      p.Scope,
			}

			permission, err := createPermission(sess, createPermissionCmd)
			if err != nil {
				return err
			}
			result.Permissions = append(result.Permissions, *permission)
		}

		return nil
	})

	return result, err
}

func (ac *RBACService) DeletePolicy(cmd *DeletePolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policyId := cmd.Id
		if policyId == 0 {
			policy, err := getPolicyByUID(sess, cmd.UID, cmd.OrgId)
			if err != nil {
				return err
			}
			policyId = policy.Id
		}

		// Delete policy's permissions
		_, err := sess.Exec("DELETE FROM permission WHERE policy_id = ?", policyId)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM policy WHERE id = ? AND org_id = ?", policyId, cmd.OrgId)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *RBACService) GetPolicyPermissions(ctx context.Context, policyID int64) ([]Permission, error) {
	var result []Permission
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permissions, err := getPolicyPermissions(sess, policyID)
		if err != nil {
			return err
		}

		result = permissions
		return nil
	})
	return result, err
}

func (ac *RBACService) CreatePermission(ctx context.Context, cmd CreatePermissionCommand) (*Permission, error) {
	var result *Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission, err := createPermission(sess, cmd)
		if err != nil {
			return err
		}

		result = permission
		return nil
	})

	return result, err
}

func (ac *RBACService) UpdatePermission(cmd *UpdatePermissionCommand) (*Permission, error) {
	var result *Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission := &Permission{
			Permission: cmd.Permission,
			Scope:      cmd.Scope,
			Updated:    timeNow(),
		}

		affectedRows, err := sess.ID(cmd.Id).Update(permission)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return ErrPermissionNotFound
		}

		result = permission
		return nil
	})

	return result, err
}

func (ac *RBACService) DeletePermission(ctx context.Context, cmd *DeletePermissionCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM permission WHERE id = ?", cmd.Id)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *RBACService) GetTeamPolicies(query *GetTeamPoliciesQuery) ([]*PolicyDTO, error) {
	var result []*PolicyDTO
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		q := `SELECT
			policy.id,
			policy.name AS name,
			policy.description AS description,
			policy.updated FROM policy AS policy
			INNER JOIN team_policy ON policy.id = team_policy.policy_id AND team_policy.team_id = ?
			WHERE policy.org_id = ? `

		if err := sess.SQL(q, query.TeamId, query.OrgId).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func (ac *RBACService) GetUserPolicies(ctx context.Context, query *GetUserPoliciesQuery) ([]*PolicyDTO, error) {
	var result []*PolicyDTO
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: optimize this
		q := `SELECT
			policy.id,
			policy.org_id,
			policy.name,
			policy.description,
			policy.created,
			policy.updated
				FROM policy
				WHERE policy.id IN (
					SELECT up.policy_id FROM user_policy AS up WHERE up.user_id = ?
					UNION
					SELECT tp.policy_id FROM team_policy as tp
						INNER JOIN team_member as tm ON tm.team_id = tp.team_id
						WHERE tm.user_id = ?
				)
				AND policy.org_id = ? `

		err := sess.SQL(q, query.UserId, query.UserId, query.OrgId).Find(&result)
		return err
	})

	return result, err
}

func (ac *RBACService) GetUserPermissions(query *GetUserPermissionsQuery) ([]*Permission, error) {
	var result []*Permission
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// TODO: optimize this
		q := `SELECT
			permission.id,
			permission.policy_id,
			permission.permission,
			permission.scope,
			permission.updated,
			permission.created
				FROM permission
				INNER JOIN policy ON policy.id = permission.policy_id
				WHERE policy.id IN (
					SELECT up.policy_id FROM user_policy AS up WHERE up.user_id = ?
					UNION
					SELECT tp.policy_id FROM team_policy as tp
						INNER JOIN team_member as tm ON tm.team_id = tp.team_id
						WHERE tm.user_id = ?
				)
				AND policy.org_id = ? `

		if err := sess.SQL(q, query.UserId, query.UserId, query.OrgId).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func (ac *RBACService) AddTeamPolicy(cmd *AddTeamPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from team_policy WHERE org_id=? and team_id=? and policy_id=?", cmd.OrgId, cmd.TeamId, cmd.PolicyId); err != nil {
			return err
		} else if len(res) == 1 {
			return ErrTeamPolicyAlreadyAdded
		}

		if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
			return err
		}

		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		teamPolicy := &TeamPolicy{
			OrgId:    cmd.OrgId,
			TeamId:   cmd.TeamId,
			PolicyId: cmd.PolicyId,
			Created:  timeNow(),
			Updated:  timeNow(),
		}

		_, err := sess.Insert(teamPolicy)
		return err
	})
}

func (ac *RBACService) RemoveTeamPolicy(cmd *RemoveTeamPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
			return err
		}

		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		q := "DELETE FROM team_policy WHERE org_id=? and team_id=? and policy_id=?"
		res, err := sess.Exec(q, cmd.OrgId, cmd.TeamId, cmd.PolicyId)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if rows == 0 {
			return ErrTeamPolicyNotFound
		}

		return err
	})
}

func (ac *RBACService) AddUserPolicy(cmd *AddUserPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from user_policy WHERE org_id=? and user_id=? and policy_id=?", cmd.OrgId, cmd.UserId, cmd.PolicyId); err != nil {
			return err
		} else if len(res) == 1 {
			return ErrUserPolicyAlreadyAdded
		}

		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		userPolicy := &UserPolicy{
			OrgId:    cmd.OrgId,
			UserId:   cmd.UserId,
			PolicyId: cmd.PolicyId,
			Created:  timeNow(),
			Updated:  timeNow(),
		}

		_, err := sess.Insert(userPolicy)
		return err
	})
}

func (ac *RBACService) RemoveUserPolicy(cmd *RemoveUserPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		q := "DELETE FROM user_policy WHERE org_id=? and user_id=? and policy_id=?"
		res, err := sess.Exec(q, cmd.OrgId, cmd.UserId, cmd.PolicyId)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if rows == 0 {
			return ErrUserPolicyNotFound
		}

		return err
	})
}

func (ac *RBACService) AddBuiltinRolePolicy(ctx context.Context, orgID, policyID int64, role string) error {
	if !models.RoleType(role).IsValid() && role != "Grafana Admin" {
		return fmt.Errorf("role '%s' is not a valid role", role)
	}

	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from builtin_role_policy WHERE policy_id=? and role=?", policyID, role); err != nil {
			return err
		} else if len(res) == 1 {
			return ErrUserPolicyAlreadyAdded
		}

		if _, err := policyExists(orgID, policyID, sess); err != nil {
			return err
		}

		policy := BuiltinRolePolicy{
			PolicyID: policyID,
			Role:     role,
			Updated:  timeNow(),
			Created:  timeNow(),
		}

		_, err := sess.Table("builtin_role_policy").Insert(policy)
		return err
	})
}

func getPolicyById(sess *sqlstore.DBSession, policyId int64, orgId int64) (*PolicyDTO, error) {
	policy := Policy{OrgId: orgId, Id: policyId}
	has, err := sess.Get(&policy)
	if !has {
		return nil, ErrPolicyNotFound
	}
	if err != nil {
		return nil, err
	}

	policyDTO := PolicyDTO{
		Id:          policyId,
		OrgId:       policy.OrgId,
		Name:        policy.Name,
		Description: policy.Description,
		Permissions: nil,
		Created:     policy.Created,
		Updated:     policy.Updated,
	}

	return &policyDTO, nil
}

func getPolicyByUID(sess *sqlstore.DBSession, uid string, orgId int64) (*PolicyDTO, error) {
	policy := Policy{OrgId: orgId, UID: uid}
	has, err := sess.Get(&policy)
	if !has {
		return nil, ErrPolicyNotFound
	}
	if err != nil {
		return nil, err
	}

	policyDTO := PolicyDTO{
		Id:          policy.Id,
		UID:         policy.UID,
		OrgId:       policy.OrgId,
		Name:        policy.Name,
		Description: policy.Description,
		Permissions: nil,
		Created:     policy.Created,
		Updated:     policy.Updated,
	}

	return &policyDTO, nil
}

func getPolicyPermissions(sess *sqlstore.DBSession, policyId int64) ([]Permission, error) {
	permissions := make([]Permission, 0)
	q := "SELECT id, policy_id, permission, scope, updated, created FROM permission WHERE policy_id = ?"
	if err := sess.SQL(q, policyId).Find(&permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

func createPermission(sess *sqlstore.DBSession, cmd CreatePermissionCommand) (*Permission, error) {
	permission := &Permission{
		PolicyId:   cmd.PolicyId,
		Permission: cmd.Permission,
		Scope:      cmd.Scope,
		Created:    timeNow(),
		Updated:    timeNow(),
	}

	if _, err := sess.Insert(permission); err != nil {
		return nil, err
	}

	return permission, nil
}

func teamExists(orgId int64, teamId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgId, teamId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, ErrTeamNotFound
	}

	return true, nil
}

func policyExists(orgId int64, policyId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from policy WHERE org_id=? and id=?", orgId, policyId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, ErrPolicyNotFound
	}

	return true, nil
}

func generateNewPolicyUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&Policy{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", ErrPolicyFailedGenerateUniqueUID
}
