package database

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/kinds/accesspolicy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/util"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func GetAccessPolicies(ctx context.Context, orgID int64, sql *session.SessionDB, resolver accesscontrol.ScopeAttributeResolverFunc) ([]accesspolicy.K8sResource, error) {
	type permissionInfo struct {
		RoleUID  string
		RoleName string
		Scope    string
		Action   string
		Created  time.Time
		Updated  time.Time
	}
	info := &permissionInfo{}
	policies := make([]accesspolicy.K8sResource, 0)
	current := &accesspolicy.K8sResource{Spec: &accesspolicy.Spec{}}
	prevKey := ""
	rows, err := sql.Query(ctx, `SELECT 
		role.uid as role_uid,
		role.name as role_name,
		scope,
		action,
		permission.created,
		permission.updated  
	FROM permission 
		JOIN role ON permission.role_id = role.id
	WHERE org_id=?
	ORDER BY role.id ASC, scope ASC, action ASC`, orgID)
	if err != nil {
		return nil, err
	}

	created := time.Now()
	updated := time.Now()

	for rows.Next() {
		err = rows.Scan(
			&info.RoleUID,
			&info.RoleName,
			&info.Scope,
			&info.Action,
			&info.Created,
			&info.Updated,
		)
		if err != nil {
			return policies, err
		}

		key := safeUIDFromFor(info.RoleUID, info.Scope)
		if key != prevKey {
			created = info.Created
			updated = info.Updated
			if len(current.Spec.Rules) > 0 {
				current.Spec.Rules = accesspolicy.ReduceRules(current.Spec.Rules)
				policies = append(policies, *current)
			}
			scope, err := resolver(ctx, orgID, info.Scope)
			if err != nil {
				return policies, err
			}
			if len(scope) != 3 {
				return policies, fmt.Errorf("expected three part scope")
			}

			// TODO?? UID from hash?
			p := accesspolicy.NewK8sResource(key, &accesspolicy.Spec{
				Role: accesspolicy.RoleRef{
					Kind:  accesspolicy.RoleRefKindRole,
					Name:  info.RoleUID,
					Xname: info.RoleName,
				},
				Scope: accesspolicy.ResourceRef{
					Kind: getKind(scope[0]),
					Name: scope[2],
				},
				Rules: make([]accesspolicy.AccessRule, 0),
			})
			p.Metadata.CreationTimestamp = v1.NewTime(created)
			p.Metadata.SetUpdatedTimestamp(&updated)
			if orgID > 1 {
				p.Metadata.Namespace = fmt.Sprintf("org-%d", orgID)
			} else {
				p.Metadata.Namespace = "default"
			}

			current = &p

			// When the value is not a UID, set the prefix to $ -- an invalid name
			if scope[1] != "uid" {
				current.Spec.Scope.Name = fmt.Sprintf("$%s:%s", scope[1], scope[2])
			}

			// Skip role+role binding for direct users
			if strings.HasPrefix(info.RoleName, "managed:users:") {
				current.Spec.Role.Kind = accesspolicy.RoleRefKindUser
				current.Spec.Role.Name = "$TODO:" + info.RoleName
			} else if strings.HasPrefix(info.RoleName, "managed:builtins:") {
				current.Spec.Role.Kind = accesspolicy.RoleRefKindBuiltinRole
				current.Spec.Role.Name = getBuiltinRoleName(info.RoleName)
			}

			prevKey = key
		}

		if info.Created.Before(created) {
			created = info.Created
			current.Metadata.CreationTimestamp = v1.NewTime(created)
		}
		if info.Updated.After(updated) {
			updated = info.Updated
			current.Metadata.SetUpdatedTimestamp(&updated)
		}

		action := strings.Split(info.Action, ":")
		if len(action) != 2 {
			return policies, fmt.Errorf("expected two part action")
		}
		parts := strings.SplitN(action[0], ".", 2)
		rule := accesspolicy.AccessRule{
			Verb: action[1],
			Kind: parts[0],
		}
		if len(parts) > 1 {
			rule.Target = util.Pointer(parts[1])
		}

		// // When the scope is dashboards or teams
		// // ... hymmm ... this would imply permissions
		// if rule.Kind == current.Spec.Scope.Kind {
		// 	rule.Kind = "*"
		// }

		current.Spec.Rules = append(current.Spec.Rules, rule)
	}
	if current.Spec.Scope.Name != "" {
		current.Spec.Rules = accesspolicy.ReduceRules(current.Spec.Rules)
		policies = append(policies, *current)
	}
	return policies, err
}

func safeUIDFromFor(role string, scope string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(role))
	_, _ = h.Write([]byte("/"))
	_, _ = h.Write([]byte(scope))
	bs := h.Sum(nil)
	return strings.ToUpper(fmt.Sprintf("P%x", bs[:8]))
}

func getKind(input string) string {
	return strings.TrimSuffix(input, "s") // dashboards > dashboard
}

func getBuiltinRoleName(input string) string {
	v := strings.TrimPrefix(input, "managed:builtins:")
	return strings.TrimSuffix(v, ":permissions")
}
