package legacypermissions_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationEmbeddedLegacySnapshotMultipleChunks(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(false)
	cfg.StackID = "12"
	catalog := legacypermissions.NewRoleCatalog()
	grants := make([]ac.Permission, 2501)
	for i := range grants {
		grants[i] = ac.Permission{Action: "users:create"}
	}
	catalog.Replace(map[string][]ac.Permission{"Viewer": grants})
	client := legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &licensing.OSSLicensingService{}, nil), cfg)
	result, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("stacks-12"), legacyclient.LegacyGetUserPermissionsRequest{
		Namespace: "stacks-12", Identity: legacyclient.LegacyPermissionIdentity{Type: types.TypeAnonymous, OrgRole: "Viewer"},
	})
	require.NoError(t, err)
	require.Len(t, result.Permissions, len(grants)+1)
	for _, permission := range result.Permissions[:len(grants)] {
		require.Equal(t, types.Permission{Action: "users:create"}, permission)
	}
	require.Equal(t, types.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}, result.Permissions[len(grants)])
}
