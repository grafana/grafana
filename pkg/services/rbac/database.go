package rbac

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ac *RBACService) GetPolicies(ctx context.Context, orgID int64) ([]*Policy, error) {
	var result []*Policy
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policies := make([]*Policy, 0)
		q := "SELECT id, org_id, name, description, updated FROM policy WHERE org_id = ?"
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

func (ac *RBACService) CreatePolicy(ctx context.Context, cmd CreatePolicyCommand) (*Policy, error) {
	var result *Policy

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		policy := &Policy{
			OrgId:       cmd.OrgId,
			Name:        cmd.Name,
			Description: cmd.Description,
			Created:     timeNow(),
			Updated:     timeNow(),
		}

		if _, err := sess.Insert(policy); err != nil {
			if ac.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "name") {
				return fmt.Errorf("policy with the name '%s' already exists: %w", cmd.Name, err)
			}
			return err
		}

		result = policy
		return nil
	})

	return result, err
}

func (ac *RBACService) UpdatePolicy(ctx context.Context, cmd UpdatePolicyCommand) (*Policy, error) {
	var result *Policy
	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		policy := &Policy{
			Name:        cmd.Name,
			Description: cmd.Description,
			Updated:     timeNow(),
		}

		affectedRows, err := sess.ID(cmd.Id).Update(policy)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return errPolicyNotFound
		}

		result = policy
		return nil
	})
	return result, err
}

func (ac *RBACService) DeletePolicy(cmd *DeletePolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// Delete policy's permissions
		_, err := sess.Exec("DELETE FROM permission WHERE policy_id = ?", cmd.Id)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM policy WHERE id = ? AND org_id = ?", cmd.Id, cmd.OrgId)
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

func (ac *RBACService) CreatePermission(ctx context.Context, cmd *CreatePermissionCommand) (*Permission, error) {
	var result *Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission := &Permission{
			PolicyId:   cmd.PolicyId,
			Permission: cmd.Permission,
			Scope:      cmd.Scope,
			Created:    timeNow(),
			Updated:    timeNow(),
		}

		if _, err := sess.Insert(permission); err != nil {
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
			return errPermissionNotFound
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
			return errTeamPolicyAlreadyAdded
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
			return errTeamPolicyNotFound
		}

		return err
	})
}

func (ac *RBACService) AddUserPolicy(cmd *AddUserPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from user_policy WHERE org_id=? and user_id=? and policy_id=?", cmd.OrgId, cmd.UserId, cmd.PolicyId); err != nil {
			return err
		} else if len(res) == 1 {
			return errUserPolicyAlreadyAdded
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
			return errUserPolicyNotFound
		}

		return err
	})
}

func getPolicyById(sess *sqlstore.DBSession, policyId int64, orgId int64) (*PolicyDTO, error) {
	policy := Policy{OrgId: orgId, Id: policyId}
	has, err := sess.Get(&policy)
	if !has {
		return nil, errPolicyNotFound
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

func getPolicyPermissions(sess *sqlstore.DBSession, policyId int64) ([]Permission, error) {
	permissions := make([]Permission, 0)
	q := "SELECT id, policy_id, permission, scope, updated, created FROM permission WHERE policy_id = ?"
	if err := sess.SQL(q, policyId).Find(&permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

func teamExists(orgId int64, teamId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgId, teamId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, errTeamNotFound
	}

	return true, nil
}

func policyExists(orgId int64, policyId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from policy WHERE org_id=? and id=?", orgId, policyId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, errPolicyNotFound
	}

	return true, nil
}
