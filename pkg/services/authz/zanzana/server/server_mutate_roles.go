package server

import (
	"context"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateRoles(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateRoles")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreateRole:
			tuples, err := convertRoleToTuples(op.CreateRole.RoleName, op.CreateRole.Permissions)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuples...)
		case *authzextv1.MutateOperation_DeleteRole:
			tuples, err := convertRoleToTuples(op.DeleteRole.RoleName, op.DeleteRole.Permissions)
			if err != nil {
				return err
			}
			deletes := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(tuples))
			for _, tuple := range tuples {
				deletes = append(deletes, common.ToOpenFGADeleteTupleKey(tuple))
			}
			deleteTuples = append(deleteTuples, deletes...)
		default:
			s.logger.Debug("unsupported mutate operation", "operation", op)
		}
	}

	err := s.writeTuples(ctx, store, writeTuples, deleteTuples)
	if err != nil {
		s.logger.Error("failed to write resource role binding tuples", "error", err)
		return err
	}

	return nil
}

// convertRoleToTuples converts role and its permissions (action/scope) to v1 TupleKey format
// using the shared zanzana.ConvertRolePermissionsToTuples utility and common.ToAuthzExtTupleKeys
func convertRoleToTuples(roleUID string, permissions []*authzextv1.RolePermission) ([]*openfgav1.TupleKey, error) {
	// Convert to zanzana.RolePermission
	rolePerms := make([]zanzana.RolePermission, 0, len(permissions))
	for _, perm := range permissions {
		// Split the scope to get kind, attribute, identifier
		kind, _, identifier := splitScope(perm.Scope)
		rolePerms = append(rolePerms, zanzana.RolePermission{
			Action:     perm.Action,
			Kind:       kind,
			Identifier: identifier,
		})
	}

	// Translate to Zanzana tuples
	tuples, err := zanzana.ConvertRolePermissionsToTuples(roleUID, rolePerms)
	if err != nil {
		return nil, err
	}

	return tuples, nil
}

func splitScope(scope string) (string, string, string) {
	if scope == "" {
		return "", "", ""
	}

	fragments := strings.Split(scope, ":")
	switch l := len(fragments); l {
	case 1: // Splitting a wildcard scope "*" -> kind: "*"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[0], fragments[0]
	case 2: // Splitting a wildcard scope with specified kind "dashboards:*" -> kind: "dashboards"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[1], fragments[1]
	default: // Splitting a scope with all fields specified "dashboards:uid:my_dash" -> kind: "dashboards"; attribute: "uid"; identifier: "my_dash"
		return fragments[0], fragments[1], strings.Join(fragments[2:], ":")
	}
}
