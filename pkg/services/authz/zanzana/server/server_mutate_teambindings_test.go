package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func setupMutateTeamBindings(t *testing.T, srv *Server) *Server {
	t.Helper()

	// seed tuples
	tuples := []*openfgav1.TupleKey{
		common.NewTuple("user:1", common.RelationTeamMember, "team:foo"),
	}

	return setupOpenFGADatabase(t, srv, tuples)
}

func testMutateTeamBindings(t *testing.T, srv *Server) {
	setupMutateTeamBindings(t, srv)

	t.Run("should update user team binding and delete old team binding", func(t *testing.T) {
		_, err := srv.Mutate(newContextWithNamespace(), &v1.MutateRequest{
			Namespace: "default",
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateTeamBinding{
						CreateTeamBinding: &v1.CreateTeamBindingOperation{
							SubjectName: "1",
							TeamName:    "foo",
							Permission:  "admin",
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeleteTeamBinding{
						DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
							SubjectName: "1",
							TeamName:    "foo",
							Permission:  "member",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		res, err := srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationTeamAdmin,
				Object:   "team:foo",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 1)
		require.Equal(t, "user:1", res.Tuples[0].Key.User)

		res, err = srv.Read(newContextWithNamespace(), &v1.ReadRequest{
			Namespace: "default",
			TupleKey: &v1.ReadRequestTupleKey{
				Relation: common.RelationTeamMember,
				Object:   "team:foo",
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Tuples, 0)
	})
}
