package migrations

import (
	"context"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCollectResourceKeys(t *testing.T) {
	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID: "test",
		Migrators: map[schema.GroupResource]MigratorFunc{
			{Group: "dashboard.grafana.app", Resource: "dashboards"}: func(_ context.Context, _ int64, _ MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			},
			{Group: "dashboard.grafana.app", Resource: "folders"}: func(_ context.Context, _ int64, _ MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			},
		},
	})

	keys := collectResourceKeys("stack-1", []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "folders"},
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "dashboard.grafana.app", Resource: "folders"},
	}, registry)

	require.Len(t, keys, 2)
	require.Equal(t, "dashboards", keys[0].Resource)
	require.Equal(t, "folders", keys[1].Resource)
}

func TestToBuildTimeMap(t *testing.T) {
	buildTimes := []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
		{
			Group:         "dashboard.grafana.app",
			Resource:      "Dashboards",
			BuildTimeUnix: 100,
		},
		{
			Group:         "dashboard.grafana.app",
			Resource:      "folders",
			BuildTimeUnix: 200,
		},
	}

	m := toBuildTimeMap(buildTimes)
	require.Equal(t, int64(100), m["dashboards"])
	require.Equal(t, int64(200), m["folders"])
}

func TestRebuildIndexes_NilResponse(t *testing.T) {
	mockClient := resource.NewMockResourceClient(t)
	mockClient.EXPECT().
		RebuildIndexes(mock.Anything, mock.Anything).
		Return(nil, nil).
		Once()

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID: "test",
		Migrators: map[schema.GroupResource]MigratorFunc{
			{Group: "dashboard.grafana.app", Resource: "dashboards"}: func(_ context.Context, _ int64, _ MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
				return nil
			},
		},
	})

	migrator := newUnifiedMigrator(nil, mockClient, log.New("test"), registry)
	err := migrator.(*unifiedMigration).rebuildIndexes(context.Background(), RebuildIndexOptions{
		NamespaceInfo: authlib.NamespaceInfo{
			OrgID: 1,
			Value: "stack-1",
		},
		Resources: []schema.GroupResource{
			{Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
		MigrationFinishedAt: time.Now(),
	})
	require.NoError(t, err)
}
