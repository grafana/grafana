package server

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestWriteAuthorization(t *testing.T) {
	srv := setupOpenFGAServer(t)
	setup(t, srv)

	req := &authzextv1.WriteRequest{
		Namespace: namespace,
		Writes: &authzextv1.WriteRequestWrites{
			TupleKeys: []*authzextv1.TupleKey{
				{
					// Folder parent tuples are valid without any relationship condition.
					User:     "folder:1",
					Relation: common.RelationParent,
					Object:   "folder:write-authz-test",
				},
			},
		},
	}

	t.Run("denies Write without zanzana:update", func(t *testing.T) {
		_, err := srv.Write(newContextWithNamespace(), req)
		require.Error(t, err)
		require.Equal(t, codes.PermissionDenied, status.Code(err))
	})

	t.Run("allows Write with zanzana:update", func(t *testing.T) {
		_, err := srv.Write(newContextWithZanzanaUpdatePermission(), req)
		require.NoError(t, err)
	})
}
