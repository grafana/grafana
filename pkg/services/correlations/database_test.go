package correlations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakedatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationCorrelationsServiceHandleDatasourceDeletion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	const orgID int64 = 1

	sqlStore := db.NewTestStore(t)
	datasourceStore := datasourceservice.CreateStore(sqlStore, log.NewNopLogger())
	addDatasource := func(uid string) *datasources.DataSource {
		datasource, err := datasourceStore.AddDataSource(ctx, &datasources.AddDataSourceCommand{
			OrgID: orgID,
			Name:  uid,
			UID:   uid,
			Type:  "testdata",
		})
		require.NoError(t, err)
		return datasource
	}

	source := addDatasource("source")
	target := addDatasource("target")
	controlTarget := addDatasource("control-target")
	service := CorrelationsService{
		SQLStore: sqlStore,
		DataSourceService: &fakedatasources.FakeDataSourceService{
			DataSources: []*datasources.DataSource{source, target, controlTarget},
		},
	}
	sqlStore.Bus().AddEventListener(service.handleDatasourceDeletion)

	createCorrelation := func(sourceUID, targetUID string) Correlation {
		correlation, err := service.createCorrelation(ctx, CreateCorrelationCommand{
			SourceUID: sourceUID,
			OrgId:     orgID,
			TargetUID: &targetUID,
			Type:      query,
			Config: CorrelationConfig{
				Field:  "message",
				Target: map[string]any{},
			},
		})
		require.NoError(t, err)
		return correlation
	}

	correlationToDeletedTarget := createCorrelation(source.UID, target.UID)
	correlationFromDeletedSource := createCorrelation(target.UID, controlTarget.UID)
	correlationToKeep := createCorrelation(source.UID, controlTarget.UID)

	err := datasourceStore.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{
		OrgID: orgID,
		UID:   target.UID,
	})
	require.NoError(t, err)

	var persisted []struct {
		UID string `xorm:"uid"`
	}
	err = sqlStore.WithDbSession(ctx, func(session *db.Session) error {
		return session.Table("correlation").Cols("uid").Where("org_id = ?", orgID).Find(&persisted)
	})
	require.NoError(t, err)
	persistedUIDs := make([]string, 0, len(persisted))
	for _, correlation := range persisted {
		persistedUIDs = append(persistedUIDs, correlation.UID)
	}
	require.NotContains(t, persistedUIDs, correlationToDeletedTarget.UID)
	require.NotContains(t, persistedUIDs, correlationFromDeletedSource.UID)
	require.Contains(t, persistedUIDs, correlationToKeep.UID)
}
