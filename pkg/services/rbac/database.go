package rbac

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func getPolicyById(sess *sqlstore.DBSession, policyId int64, orgId int64) (*Policy, error) {
	policy := Policy{OrgId: orgId, Id: policyId}
	has, err := sess.Get(&policy)
	if !has {
		return nil, errPolicyNotFound
	}
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func getPolicyPermissions(sess *sqlstore.DBSession, policyId int64) ([]Permission, error) {
	permissions := make([]Permission, 0)
	q := "SELECT id, resource, resource_type, action FROM permission WHERE policy_id = ?"
	if err := sess.SQL(q, policyId).Find(&permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

func (ac *RBACService) getPolicies(query *listPoliciesQuery) error {
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

func (ac *RBACService) getPolicy(query *getPolicyQuery) error {
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

func (ac *RBACService) getPolicyPermissions(query *getPolicyPermissionsQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permissions, err := getPolicyPermissions(sess, query.PolicyId)
		if err != nil {
			return err
		}

		query.Result = permissions
		return nil
	})
}

func (ac *RBACService) getTeamPolicies(query *getTeamPoliciesQuery) error {
	return ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		query.Result = make([]*Policy, 0)
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
