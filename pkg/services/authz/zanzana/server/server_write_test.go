package server

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/stretchr/testify/require"
)

func TestWriteAuthorization(t *testing.T) {
	cfg := setting.NewCfg()
	testStore := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	srv := setupOpenFGAServer(t, testStore, cfg)
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
