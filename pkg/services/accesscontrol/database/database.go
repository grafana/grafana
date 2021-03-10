package database

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

type AccessControlStore struct {
	SQLStore *sqlstore.SQLStore `inject:""`
}

func init() {
	registry.RegisterService(&AccessControlStore{})
}

func (ac *AccessControlStore) Init() error {
	return nil
}

func (ac *AccessControlStore) GetPolicies(ctx context.Context, orgID int64) ([]*accesscontrol.Policy, error) {
	var result []*accesscontrol.Policy
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		policies := make([]*accesscontrol.Policy, 0)
		q := "SELECT id, uid, org_id, name, description, updated FROM policy WHERE org_id = ?"
		if err := sess.SQL(q, orgID).Find(&policies); err != nil {
			return err
		}

		result = policies
		return nil
	})
	return result, err
}

func (ac *AccessControlStore) GetPolicy(ctx context.Context, orgID, policyID int64) (*accesscontrol.PolicyDTO, error) {
	var result *accesscontrol.PolicyDTO

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

func (ac *AccessControlStore) GetPolicyByUID(ctx context.Context, orgId int64, uid string) (*accesscontrol.PolicyDTO, error) {
	var result *accesscontrol.PolicyDTO

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

func (ac *AccessControlStore) CreatePolicy(ctx context.Context, cmd accesscontrol.CreatePolicyCommand) (*accesscontrol.Policy, error) {
	var result *accesscontrol.Policy

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

func (ac *AccessControlStore) createPolicy(sess *sqlstore.DBSession, cmd accesscontrol.CreatePolicyCommand) (*accesscontrol.Policy, error) {
	if cmd.UID == "" {
		uid, err := generateNewPolicyUID(sess, cmd.OrgId)
		if err != nil {
			return nil, fmt.Errorf("failed to generate UID for policy %q: %w", cmd.Name, err)
		}
		cmd.UID = uid
	}

	policy := &accesscontrol.Policy{
		OrgId:       cmd.OrgId,
		UID:         cmd.UID,
		Name:        cmd.Name,
		Description: cmd.Description,
		Created:     TimeNow(),
		Updated:     TimeNow(),
	}

	if _, err := sess.Insert(policy); err != nil {
		if ac.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "name") {
			return nil, fmt.Errorf("policy with the name '%s' already exists: %w", cmd.Name, err)
		}
		return nil, err
	}

	return policy, nil
}

func (ac *AccessControlStore) CreatePolicyWithPermissions(ctx context.Context, cmd accesscontrol.CreatePolicyWithPermissionsCommand) (*accesscontrol.PolicyDTO, error) {
	var result *accesscontrol.PolicyDTO

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		createPolicyCmd := accesscontrol.CreatePolicyCommand{
			OrgId:       cmd.OrgId,
			UID:         cmd.UID,
			Name:        cmd.Name,
			Description: cmd.Description,
		}

		policy, err := ac.createPolicy(sess, createPolicyCmd)
		if err != nil {
			return err
		}

		result = &accesscontrol.PolicyDTO{
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
			createPermissionCmd := accesscontrol.CreatePermissionCommand{
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
func (ac *AccessControlStore) UpdatePolicy(ctx context.Context, cmd accesscontrol.UpdatePolicyCommand) (*accesscontrol.PolicyDTO, error) {
	var result *accesscontrol.PolicyDTO
	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: work with both ID and UID
		existingPolicy, err := getPolicyByUID(sess, cmd.UID, cmd.OrgId)
		if err != nil {
			return err
		}

		version := existingPolicy.Version + 1
		if cmd.Version != 0 {
			if existingPolicy.Version >= cmd.Version {
				return fmt.Errorf(
					"could not update '%s' (UID %s) from version %d to %d: %w",
					cmd.Name,
					existingPolicy.UID,
					existingPolicy.Version,
					cmd.Version,
					accesscontrol.ErrVersionLE,
				)
			}
			version = cmd.Version
		}

		policy := &accesscontrol.Policy{
			Id:          existingPolicy.Id,
			UID:         existingPolicy.UID,
			Version:     version,
			OrgId:       existingPolicy.OrgId,
			Name:        cmd.Name,
			Description: cmd.Description,
			Updated:     TimeNow(),
		}

		affectedRows, err := sess.ID(existingPolicy.Id).Update(policy)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return accesscontrol.ErrPolicyNotFound
		}

		result = &accesscontrol.PolicyDTO{
			Id:          policy.Id,
			Version:     version,
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
			createPermissionCmd := accesscontrol.CreatePermissionCommand{
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

func (ac *AccessControlStore) DeletePolicy(cmd *accesscontrol.DeletePolicyCommand) error {
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

func (ac *AccessControlStore) GetPolicyPermissions(ctx context.Context, policyID int64) ([]accesscontrol.Permission, error) {
	var result []accesscontrol.Permission
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

func (ac *AccessControlStore) CreatePermission(ctx context.Context, cmd accesscontrol.CreatePermissionCommand) (*accesscontrol.Permission, error) {
	var result *accesscontrol.Permission
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

func (ac *AccessControlStore) UpdatePermission(cmd *accesscontrol.UpdatePermissionCommand) (*accesscontrol.Permission, error) {
	var result *accesscontrol.Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission := &accesscontrol.Permission{
			Permission: cmd.Permission,
			Scope:      cmd.Scope,
			Updated:    TimeNow(),
		}

		affectedRows, err := sess.ID(cmd.Id).Update(permission)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return accesscontrol.ErrPermissionNotFound
		}

		result = permission
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) DeletePermission(ctx context.Context, cmd *accesscontrol.DeletePermissionCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM permission WHERE id = ?", cmd.Id)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *AccessControlStore) GetTeamPolicies(query *accesscontrol.GetTeamPoliciesQuery) ([]*accesscontrol.PolicyDTO, error) {
	var result []*accesscontrol.PolicyDTO
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

func (ac *AccessControlStore) GetUserPolicies(ctx context.Context, query accesscontrol.GetUserPoliciesQuery) ([]*accesscontrol.PolicyDTO, error) {
	var result []*accesscontrol.PolicyDTO
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: optimize this
		filter, params := ac.userPoliciesFilter(query.OrgId, query.UserId, query.Roles)

		q := `SELECT
			policy.id,
			policy.org_id,
			policy.name,
			policy.description,
			policy.created,
			policy.updated
				FROM policy
				` + filter

		err := sess.SQL(q, params...).Find(&result)
		return err
	})

	return result, err
}

func (ac *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]*accesscontrol.Permission, error) {
	var result []*accesscontrol.Permission
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		filter, params := ac.userPoliciesFilter(query.OrgId, query.UserId, query.Roles)

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
				` + filter

		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func (*AccessControlStore) userPoliciesFilter(orgID, userID int64, roles []string) (string, []interface{}) {
	q := `WHERE policy.id IN (
		SELECT up.policy_id FROM user_policy AS up WHERE up.user_id = ?
		UNION
		SELECT tp.policy_id FROM team_policy as tp
			INNER JOIN team_member as tm ON tm.team_id = tp.team_id
			WHERE tm.user_id = ?`
	params := []interface{}{userID, userID}

	if len(roles) != 0 {
		q += `
	UNION
	SELECT rp.policy_id FROM builtin_role_policy AS rp
	WHERE role IN (? ` + strings.Repeat(", ?", len(roles)-1) + `)`
		for _, role := range roles {
			params = append(params, role)
		}
	}

	q += `) and policy.org_id = ?`
	params = append(params, orgID)

	return q, params
}

func (ac *AccessControlStore) AddTeamPolicy(cmd *accesscontrol.AddTeamPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from team_policy WHERE org_id=? and team_id=? and policy_id=?", cmd.OrgId, cmd.TeamId, cmd.PolicyId); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrTeamPolicyAlreadyAdded
		}

		if _, err := teamExists(cmd.OrgId, cmd.TeamId, sess); err != nil {
			return err
		}

		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		teamPolicy := &accesscontrol.TeamPolicy{
			OrgId:    cmd.OrgId,
			TeamId:   cmd.TeamId,
			PolicyId: cmd.PolicyId,
			Created:  TimeNow(),
			Updated:  TimeNow(),
		}

		_, err := sess.Insert(teamPolicy)
		return err
	})
}

func (ac *AccessControlStore) RemoveTeamPolicy(cmd *accesscontrol.RemoveTeamPolicyCommand) error {
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
			return accesscontrol.ErrTeamPolicyNotFound
		}

		return err
	})
}

func (ac *AccessControlStore) AddUserPolicy(cmd *accesscontrol.AddUserPolicyCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from user_policy WHERE org_id=? and user_id=? and policy_id=?", cmd.OrgId, cmd.UserId, cmd.PolicyId); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrUserPolicyAlreadyAdded
		}

		if _, err := policyExists(cmd.OrgId, cmd.PolicyId, sess); err != nil {
			return err
		}

		userPolicy := &accesscontrol.UserPolicy{
			OrgId:    cmd.OrgId,
			UserId:   cmd.UserId,
			PolicyId: cmd.PolicyId,
			Created:  TimeNow(),
			Updated:  TimeNow(),
		}

		_, err := sess.Insert(userPolicy)
		return err
	})
}

func (ac *AccessControlStore) RemoveUserPolicy(cmd *accesscontrol.RemoveUserPolicyCommand) error {
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
			return accesscontrol.ErrUserPolicyNotFound
		}

		return err
	})
}

func (ac *AccessControlStore) AddBuiltinRolePolicy(ctx context.Context, orgID, policyID int64, role string) error {
	if !models.RoleType(role).IsValid() && role != "Grafana Admin" {
		return fmt.Errorf("role '%s' is not a valid role", role)
	}

	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from builtin_role_policy WHERE policy_id=? and role=?", policyID, role); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrUserPolicyAlreadyAdded
		}

		if _, err := policyExists(orgID, policyID, sess); err != nil {
			return err
		}

		policy := accesscontrol.BuiltinRolePolicy{
			PolicyID: policyID,
			Role:     role,
			Updated:  TimeNow(),
			Created:  TimeNow(),
		}

		_, err := sess.Table("builtin_role_policy").Insert(policy)
		return err
	})
}

func getPolicyById(sess *sqlstore.DBSession, policyId int64, orgId int64) (*accesscontrol.PolicyDTO, error) {
	policy := accesscontrol.Policy{OrgId: orgId, Id: policyId}
	has, err := sess.Get(&policy)
	if !has {
		return nil, accesscontrol.ErrPolicyNotFound
	}
	if err != nil {
		return nil, err
	}

	policyDTO := accesscontrol.PolicyDTO{
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

func getPolicyByUID(sess *sqlstore.DBSession, uid string, orgId int64) (*accesscontrol.PolicyDTO, error) {
	policy := accesscontrol.Policy{OrgId: orgId, UID: uid}
	has, err := sess.Get(&policy)
	if !has {
		return nil, accesscontrol.ErrPolicyNotFound
	}
	if err != nil {
		return nil, err
	}

	policyDTO := accesscontrol.PolicyDTO{
		Id:          policy.Id,
		UID:         policy.UID,
		Version:     policy.Version,
		OrgId:       policy.OrgId,
		Name:        policy.Name,
		Description: policy.Description,
		Permissions: nil,
		Created:     policy.Created,
		Updated:     policy.Updated,
	}

	return &policyDTO, nil
}

func getPolicyPermissions(sess *sqlstore.DBSession, policyId int64) ([]accesscontrol.Permission, error) {
	permissions := make([]accesscontrol.Permission, 0)
	q := "SELECT id, policy_id, permission, scope, updated, created FROM permission WHERE policy_id = ?"
	if err := sess.SQL(q, policyId).Find(&permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

func createPermission(sess *sqlstore.DBSession, cmd accesscontrol.CreatePermissionCommand) (*accesscontrol.Permission, error) {
	permission := &accesscontrol.Permission{
		PolicyId:   cmd.PolicyId,
		Permission: cmd.Permission,
		Scope:      cmd.Scope,
		Created:    TimeNow(),
		Updated:    TimeNow(),
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
		return false, accesscontrol.ErrTeamNotFound
	}

	return true, nil
}

func policyExists(orgId int64, policyId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from policy WHERE org_id=? and id=?", orgId, policyId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, accesscontrol.ErrPolicyNotFound
	}

	return true, nil
}

func generateNewPolicyUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&accesscontrol.Policy{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", accesscontrol.ErrPolicyFailedGenerateUniqueUID
}

func MockTimeNow() {
	var timeSeed int64
	TimeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func ResetTimeNow() {
	TimeNow = time.Now
}
