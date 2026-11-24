package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
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
		grants[i] = ac.Permission{Action: "users:create", Scope: fmt.Sprintf("users:uid:user-%d", i)}
	}
	catalog.Replace(map[string][]ac.Permission{"Viewer": grants})
	reg := prometheus.NewRegistry()
	client := legacypermissions.ProvideClient(legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &licensing.OSSLicensingService{}, nil), cfg, reg)
	result, err := client.LegacyGetUserPermissions(context.Background(), legacypermissions.LegacyPermissionCaller("stacks-12"), legacyclient.LegacyGetUserPermissionsRequest{
		Namespace: "stacks-12", Identity: legacyclient.LegacyPermissionIdentity{Type: types.TypeAnonymous, OrgRole: "Viewer"},
	})
	require.NoError(t, err)
	require.Len(t, result.Permissions, len(grants)+1)
	for i, permission := range result.Permissions[:len(grants)] {
		require.Equal(t, types.Permission{Action: grants[i].Action, Scope: grants[i].Scope}, permission)
	}
	require.Equal(t, types.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}, result.Permissions[len(grants)])
	families, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, families, 1)
	for _, metric := range families[0].Metric {
		for _, label := range metric.Label {
			if label.GetName() == "status" {
				var count uint64
				if label.GetValue() == "ok" {
					count = 1
				}
				require.Equal(t, count, metric.Histogram.GetSampleCount())
			}
		}
	}
}
