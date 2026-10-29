package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type folderContractIAM struct{ t *testing.T }

func (p folderContractIAM) GetRestConfig(context.Context) (*clientrest.Config, error) {
	p.t.Fatal("folder scopes must not require IAM ID lookups")
	return nil, nil
}

type folderContractStream struct {
	grpc.ServerStream
	ctx   context.Context
	pairs map[[2]string]bool
}

func (s *folderContractStream) Context() context.Context { return s.ctx }
func (s *folderContractStream) Send(response *authzv1.GetUserPermissionsResponse) error {
	for _, p := range response.Permissions {
		s.pairs[[2]string{p.Action, p.Scope}] = true
	}
	return nil
}

func TestIntegrationZanzanaMatchesLegacyFolderGrantScopes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	cfg := setting.NewCfg()
	cfg.RBAC.PermissionCache = false
	cfg.ZanzanaServer.AllowInsecure = true
	loader := legacypermissions.NewLoader(database, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: true}, nil)
	grants := []accesscontrol.Permission{
		{Action: "folders:read", Scope: "folders:uid:parent"},
		{Action: "dashboards:read", Scope: "folders:uid:parent"},
		{Action: "folders:read", Scope: "folders:uid:child"},
		{Action: "folders:write", Scope: "folders:uid:child"},
	}
	for i, p := range grants {
		seedGrant(t, database, fmt.Sprintf("managed:folder-contract-%d", i), 1, 7, p)
	}
	legacy, err := loader.GetUserPermissions(t.Context(), &user.SignedInUser{UserID: 7, UserUID: "alice", OrgID: 1, OrgRole: org.RoleNone}, accesscontrol.Options{})
	require.NoError(t, err)
	want := map[[2]string]bool{}
	for _, p := range legacy {
		// The legacy loader supplies this virtual folder independently of migrated grants.
		if p.Scope != folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID) {
			want[[2]string{p.Action, p.Scope}] = true
		}
	}
	require.Len(t, want, 4)

	datastore := memory.New()
	srv, err := zserver.NewEmbeddedZanzanaServer(cfg, datastore, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), folderContractIAM{t}, nil, leaderelection.NewDefaultElector(), nil)
	require.NoError(t, err)
	t.Cleanup(srv.Close)
	store, err := srv.GetOrCreateStore(t.Context(), "default")
	require.NoError(t, err)
	tuples := []*openfgav1.TupleKey{
		common.NewFolderTuple("user:alice", common.RelationGet, "parent"),
		common.NewFolderResourceTuple("user:alice", common.RelationGet, "dashboard.grafana.app", "dashboards", "", "parent"),
		common.NewFolderTuple("user:alice", common.RelationGet, "child"),
		common.NewFolderTuple("user:alice", common.RelationUpdate, "child"),
		common.NewFolderParentTuple("child", "parent"),
		common.NewFolderParentTuple("grandchild", "child"),
	}
	require.NoError(t, datastore.Write(t.Context(), store.ID, nil, tuples))
	ctx := types.WithAuthInfo(t.Context(), authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Namespace: "default", Permissions: []string{zanzana.TokenPermissionUserPermissions}}}))
	stream := &folderContractStream{ctx: ctx, pairs: map[[2]string]bool{}}
	require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, stream))
	require.Equal(t, want, stream.pairs)
}
