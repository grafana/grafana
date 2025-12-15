package server

import (
	"context"
	"errors"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateTeamBindings(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateTeamBindings")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreateTeamBinding:
			tuple, err := s.getTeamBindingTuple(ctx, op.CreateTeamBinding.GetSubjectName(), op.CreateTeamBinding.GetTeamName(), op.CreateTeamBinding.GetPermission())
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeleteTeamBinding:
			tuple, err := s.getTeamBindingTuple(ctx, op.DeleteTeamBinding.GetSubjectName(), op.DeleteTeamBinding.GetTeamName(), op.DeleteTeamBinding.GetPermission())
			if err != nil {
				return err
			}
			deleteTuple := &openfgav1.TupleKeyWithoutCondition{
				User:     tuple.User,
				Relation: tuple.Relation,
				Object:   tuple.Object,
			}
			deleteTuples = append(deleteTuples, deleteTuple)
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

func (s *Server) getTeamBindingTuple(ctx context.Context, subject string, team string, permission string) (*openfgav1.TupleKey, error) {
	if subject == "" {
		return nil, errors.New("subject name cannot be empty")
	}

	if team == "" {
		return nil, errors.New("team name cannot be empty")
	}

	relation := ""
	switch permission {
	case string(iamv0.TeamBindingTeamPermissionAdmin):
		relation = zanzana.RelationTeamAdmin
	case string(iamv0.TeamBindingTeamPermissionMember):
		relation = zanzana.RelationTeamMember
	default:
		return nil, fmt.Errorf("unknown team permission '%s', expected member or admin", permission)
	}

	tuple := &openfgav1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, subject, ""),
		Relation: relation,
		Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, team, ""),
	}

	return tuple, nil
}
