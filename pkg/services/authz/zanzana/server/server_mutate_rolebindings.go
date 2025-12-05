package server

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateRoleBindings(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateRoleBindings")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreateRoleBinding:
			r := op.CreateRoleBinding
			tuple, err := s.getRoleBindingTuple(ctx, r.SubjectKind, r.SubjectName, r.RoleName)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeleteRoleBinding:
			r := op.DeleteRoleBinding
			tuple, err := s.getRoleBindingTuple(ctx, r.SubjectKind, r.SubjectName, r.RoleName)
			if err != nil {
				return err
			}
			writeTuple := &openfgav1.TupleKeyWithoutCondition{
				User:     tuple.User,
				Relation: tuple.Relation,
				Object:   tuple.Object,
			}
			deleteTuples = append(deleteTuples, writeTuple)
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

func (s *Server) getRoleBindingTuple(ctx context.Context, subjectKind string, subjectName string, roleName string) (*openfgav1.TupleKey, error) {
	zanzanaType := ""
	subjectRelation := ""

	switch subjectKind {
	case string(iamv0.RoleBindingSpecSubjectKindUser):
		zanzanaType = zanzana.TypeUser
	case string(iamv0.RoleBindingSpecSubjectKindTeam):
		zanzanaType = zanzana.TypeTeam
		subjectRelation = zanzana.RelationTeamMember
	case string(iamv0.RoleBindingSpecSubjectKindServiceAccount):
		zanzanaType = zanzana.TypeServiceAccount
	case string(iamv0.RoleBindingSpecSubjectKindBasicRole):
		zanzanaType = zanzana.TypeRole
		subjectRelation = zanzana.RelationAssignee
	default:
		return nil, fmt.Errorf("invalid subject kind: %s", subjectKind)
	}

	tuple := &openfgav1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzanaType, subjectName, subjectRelation),
		Relation: zanzana.RelationAssignee,
		Object:   zanzana.NewTupleEntry(zanzana.TypeRole, roleName, ""),
	}

	return tuple, nil
}
