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

func (ac *RBACService) GetPolicies(query *ListPoliciesQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policies := make([]*Policy, 0)
		q := "SELECT id, org_id, name, description, updated FROM policy WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgId).Find(&policies); err != nil {
			return err
		}

		query.Result = policies
		return nil
	})
}

func (ac *RBACService) GetPolicy(query *GetPolicyQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policy, err := getPolicyById(sess, query.PolicyId, query.OrgId)
		if err != nil {
			return err
		}

		permissions, err := getPolicyPermissions(sess, query.PolicyId)
		if err != nil {
			return err
		}

		policy.Permissions = permissions
		query.Result = policy
		return nil
	})
}

func (ac *RBACService) CreatePolicy(cmd *CreatePolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

		cmd.Result = policy
		return nil
	})
}

func (ac *RBACService) DeletePolicy(cmd *DeletePolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM policy WHERE id = ? AND org_id = ?", cmd.Id, cmd.OrgId)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *RBACService) GetPolicyPermissions(query *GetPolicyPermissionsQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permissions, err := getPolicyPermissions(sess, query.PolicyId)
		if err != nil {
			return err
		}

		query.Result = permissions
		return nil
	})
}

func (ac *RBACService) CreatePermission(cmd *CreatePermissionCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

		cmd.Result = permission
		return nil
	})
}

func (ac *RBACService) DeletePermission(cmd *DeletePermissionCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM permission WHERE id = ?", cmd.Id)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *RBACService) GetTeamPolicies(query *GetTeamPoliciesQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		query.Result = make([]*PolicyDTO, 0)
		q := `SELECT
			policy.id,
			policy.name AS name,
			policy.description AS description,
			policy.updated FROM policy AS policy
			INNER JOIN team_policy ON policy.id = team_policy.policy_id AND team_policy.team_id = ?
			WHERE policy.org_id = ? `

		if err := sess.SQL(q, query.TeamId, query.OrgId).Find(&query.Result); err != nil {
			return err
		}

		return nil
	})
}

func (ac *RBACService) GetUserPolicies(query *GetUserPoliciesQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		query.Result = make([]*PolicyDTO, 0)
		// TODO: optimize this
		q := `SELECT
			up.policy_id,
			up.user_id,
			policy.id,
			policy.org_id,
			policy.name,
			policy.description,
			policy.created,
			policy.updated
				FROM policy
				LEFT JOIN user_policy AS up ON policy.id = up.policy_id
					AND up.user_id = ?
				LEFT JOIN team_member as tm ON tm.user_id = ?
				LEFT JOIN team_policy as tp ON policy.id = tp.policy_id
					AND tp.team_id = tm.team_id
				WHERE policy.org_id = ?
		`

		err := sess.SQL(q, query.UserId, query.UserId, query.OrgId).Find(&query.Result)
		return err
	})
}

func (ac *RBACService) GetUserPermissions(query *GetUserPermissionsQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		query.Result = make([]Permission, 0)
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
				LEFT JOIN user_policy AS up ON policy.id = up.policy_id
					AND up.user_id = ?
				LEFT JOIN team_member as tm ON tm.user_id = ?
				LEFT JOIN team_policy as tp ON policy.id = tp.policy_id
					AND tp.team_id = tm.team_id
				WHERE policy.org_id = ? `

		if err := sess.SQL(q, query.UserId, query.UserId, query.OrgId).Find(&query.Result); err != nil {
			return err
		}

		return nil
	})
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
