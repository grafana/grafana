package service

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestIntegrationDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	defaultAddDatasourceCommand := datasources.AddDataSourceCommand{
		OrgID:  10,
		Name:   "nisse",
		Type:   datasources.DS_GRAPHITE,
		Access: datasources.DS_ACCESS_DIRECT,
		URL:    "http://test",
	}

	defaultUpdateDatasourceCommand := datasources.UpdateDataSourceCommand{
		OrgID:  10,
		Name:   "nisse_updated",
		Type:   datasources.DS_GRAPHITE,
		Access: datasources.DS_ACCESS_DIRECT,
		URL:    "http://test",
	}

	initDatasource := func(db db.DB) *datasources.DataSource {
		cmd := defaultAddDatasourceCommand
		ss := SqlStore{db: db}
		_, err := ss.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := datasources.GetDataSourcesQuery{OrgID: 10}
		dataSources, err := ss.GetDataSources(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, 1, len(dataSources))

		return dataSources[0]
	}

	t.Run("AddDataSource", func(t *testing.T) {
		t.Run("Can add datasource", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}
			_, err := ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
				OrgID:    10,
				Name:     "laban",
				Type:     datasources.DS_GRAPHITE,
				Access:   datasources.DS_ACCESS_DIRECT,
				URL:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			query := datasources.GetDataSourcesQuery{OrgID: 10}
			dataSources, err := ss.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 1, len(dataSources))
			ds := dataSources[0]

			require.EqualValues(t, 10, ds.OrgID)
			require.Equal(t, "site", ds.Database)
			require.True(t, ds.ReadOnly)
		})

		t.Run("generates uid if not specified", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			require.NotEmpty(t, ds.UID)
		})

		t.Run("fails to insert ds with same uid", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}
			cmd1 := defaultAddDatasourceCommand
			cmd2 := defaultAddDatasourceCommand
			cmd1.UID = "test"
			cmd2.UID = "test"
			_, err := ss.AddDataSource(context.Background(), &cmd1)
			require.NoError(t, err)
			_, err = ss.AddDataSource(context.Background(), &cmd2)
			require.Error(t, err)
			require.IsType(t, datasources.ErrDataSourceUidExists, err)
		})

		t.Run("fires an event when the datasource is added", func(t *testing.T) {
			db := db.InitTestDB(t)
			sqlStore := SqlStore{db: db}
			var created *events.DataSourceCreated
			db.Bus().AddEventListener(func(ctx context.Context, e *events.DataSourceCreated) error {
				created = e
				return nil
			})

			_, err := sqlStore.AddDataSource(context.Background(), &defaultAddDatasourceCommand)
			require.NoError(t, err)

			require.Eventually(t, func() bool {
				return assert.NotNil(t, created)
			}, time.Second, time.Millisecond)

			query := datasources.GetDataSourcesQuery{OrgID: 10}
			dataSources, err := sqlStore.GetDataSources(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, 1, len(dataSources))

			require.Equal(t, dataSources[0].ID, created.ID)
			require.Equal(t, dataSources[0].UID, created.UID)
			require.Equal(t, int64(10), created.OrgID)
			require.Equal(t, "nisse", created.Name)
		})
	})

	t.Run("UpdateDataSource", func(t *testing.T) {
		t.Run("updates datasource with version", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			cmd := defaultUpdateDatasourceCommand
			cmd.ID = ds.ID
			cmd.Version = ds.Version
			ss := SqlStore{db: db}
			_, err := ss.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)
		})

		t.Run("does not overwrite UID if not specified", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}
			require.NotEmpty(t, ds.UID)

			cmd := defaultUpdateDatasourceCommand
			cmd.ID = ds.ID
			_, err := ss.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)

			query := datasources.GetDataSourceQuery{ID: ds.ID, OrgID: 10}
			dataSource, err := ss.GetDataSource(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, ds.UID, dataSource.UID)
		})

		t.Run("prevents update if version changed", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}

			cmd := datasources.UpdateDataSourceCommand{
				ID:      ds.ID,
				OrgID:   10,
				Name:    "nisse",
				Type:    datasources.DS_GRAPHITE,
				Access:  datasources.DS_ACCESS_PROXY,
				URL:     "http://test",
				Version: ds.Version,
			}
			// Make a copy as UpdateDataSource modifies it
			cmd2 := cmd

			_, err := ss.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)

			_, err = ss.UpdateDataSource(context.Background(), &cmd2)
			require.Error(t, err)
		})

		t.Run("updates ds without version specified", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}

			cmd := &datasources.UpdateDataSourceCommand{
				ID:     ds.ID,
				OrgID:  10,
				Name:   "nisse",
				Type:   datasources.DS_GRAPHITE,
				Access: datasources.DS_ACCESS_PROXY,
				URL:    "http://test",
			}

			_, err := ss.UpdateDataSource(context.Background(), cmd)
			require.NoError(t, err)
		})

		t.Run("updates ds without higher version", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}

			cmd := &datasources.UpdateDataSourceCommand{
				ID:      ds.ID,
				OrgID:   10,
				Name:    "nisse",
				Type:    datasources.DS_GRAPHITE,
				Access:  datasources.DS_ACCESS_PROXY,
				URL:     "http://test",
				Version: 90000,
			}

			_, err := ss.UpdateDataSource(context.Background(), cmd)
			require.NoError(t, err)
		})
	})

	t.Run("DeleteDataSourceById", func(t *testing.T) {
		t.Run("can delete datasource", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}

			err := ss.DeleteDataSource(context.Background(), &datasources.DeleteDataSourceCommand{ID: ds.ID, OrgID: ds.OrgID})
			require.NoError(t, err)

			query := datasources.GetDataSourcesQuery{OrgID: 10}
			dataSources, err := ss.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 0, len(dataSources))
		})

		t.Run("Can not delete datasource with wrong orgID", func(t *testing.T) {
			db := db.InitTestDB(t)
			ds := initDatasource(db)
			ss := SqlStore{db: db}

			err := ss.DeleteDataSource(context.Background(),
				&datasources.DeleteDataSourceCommand{ID: ds.ID, OrgID: 123123})
			require.NoError(t, err)

			query := datasources.GetDataSourcesQuery{OrgID: 10}
			dataSources, err := ss.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 1, len(dataSources))
		})
	})

	t.Run("fires an event when the datasource is deleted", func(t *testing.T) {
		db := db.InitTestDB(t)
		ds := initDatasource(db)
		ss := SqlStore{db: db}

		var deleted *events.DataSourceDeleted
		db.Bus().AddEventListener(func(ctx context.Context, e *events.DataSourceDeleted) error {
			deleted = e
			return nil
		})

		err := ss.DeleteDataSource(context.Background(),
			&datasources.DeleteDataSourceCommand{ID: ds.ID, UID: ds.UID, Name: ds.Name, OrgID: ds.OrgID})
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			return assert.NotNil(t, deleted)
		}, time.Second, time.Millisecond)

		require.Equal(t, ds.ID, deleted.ID)
		require.Equal(t, ds.OrgID, deleted.OrgID)
		require.Equal(t, ds.Name, deleted.Name)
		require.Equal(t, ds.UID, deleted.UID)
	})

	t.Run("does not fire an event when the datasource is not deleted", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := SqlStore{db: db}

		var called bool
		db.Bus().AddEventListener(func(ctx context.Context, e *events.DataSourceDeleted) error {
			called = true
			return nil
		})

		err := ss.DeleteDataSource(context.Background(),
			&datasources.DeleteDataSourceCommand{ID: 1, UID: "non-existing", Name: "non-existing", OrgID: int64(10)})
		require.NoError(t, err)

		require.Never(t, func() bool {
			return called
		}, time.Second, time.Millisecond)
	})

	t.Run("DeleteDataSourceByName", func(t *testing.T) {
		db := db.InitTestDB(t)
		ds := initDatasource(db)
		ss := SqlStore{db: db}
		query := datasources.GetDataSourcesQuery{OrgID: 10}

		err := ss.DeleteDataSource(context.Background(), &datasources.DeleteDataSourceCommand{Name: ds.Name, OrgID: ds.OrgID})
		require.NoError(t, err)

		dataSources, err := ss.GetDataSources(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, 0, len(dataSources))
	})

	t.Run("DeleteDataSourceAccessControlPermissions", func(t *testing.T) {
		store := db.InitTestDB(t)
		ds := initDatasource(store)
		ss := SqlStore{db: store}

		// Init associated permission
		errAddPermissions := store.WithTransactionalDbSession(context.TODO(), func(sess *db.Session) error {
			_, err := sess.Table("permission").Insert(ac.Permission{
				RoleID:  1,
				Action:  "datasources:read",
				Scope:   datasources.ScopeProvider.GetResourceScope(ds.UID),
				Updated: time.Now(),
				Created: time.Now(),
			})
			return err
		})
		require.NoError(t, errAddPermissions)
		query := datasources.GetDataSourcesQuery{OrgID: 10}

		errDeletingDS := ss.DeleteDataSource(context.Background(),
			&datasources.DeleteDataSourceCommand{Name: ds.Name, OrgID: ds.OrgID},
		)
		require.NoError(t, errDeletingDS)

		// Check associated permission
		permCount := int64(0)
		errGetPermissions := store.WithTransactionalDbSession(context.TODO(), func(sess *db.Session) error {
			var err error
			permCount, err = sess.Table("permission").Count()
			return err
		})
		require.NoError(t, errGetPermissions)
		require.Zero(t, permCount, "permissions associated to the data source should have been removed")

		dataSources, err := ss.GetDataSources(context.Background(), &query)

		require.NoError(t, err)
		require.Equal(t, 0, len(dataSources))
	})

	t.Run("GetDataSources", func(t *testing.T) {
		t.Run("Number of data sources returned limited to 6 per organization", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}
			datasourceLimit := 6
			for i := 0; i < datasourceLimit+1; i++ {
				_, err := ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
					OrgID:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     datasources.DS_GRAPHITE,
					Access:   datasources.DS_ACCESS_DIRECT,
					URL:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := datasources.GetDataSourcesQuery{OrgID: 10, DataSourceLimit: datasourceLimit}

			dataSources, err := ss.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, datasourceLimit, len(dataSources))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is not set", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				_, err := ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
					OrgID:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     datasources.DS_GRAPHITE,
					Access:   datasources.DS_ACCESS_DIRECT,
					URL:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := datasources.GetDataSourcesQuery{OrgID: 10}

			dataSources, err := ss.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(dataSources))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is negative", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				_, err := ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
					OrgID:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     datasources.DS_GRAPHITE,
					Access:   datasources.DS_ACCESS_DIRECT,
					URL:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := datasources.GetDataSourcesQuery{OrgID: 10, DataSourceLimit: -1}

			dataSources, err := ss.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(dataSources))
		})
	})

	t.Run("GetDataSourcesByType", func(t *testing.T) {
		t.Run("Only returns datasources of specified type", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}

			_, err := ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
				OrgID:    10,
				Name:     "Elasticsearch",
				Type:     datasources.DS_ES,
				Access:   datasources.DS_ACCESS_DIRECT,
				URL:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			_, err = ss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
				OrgID:    10,
				Name:     "Graphite",
				Type:     datasources.DS_GRAPHITE,
				Access:   datasources.DS_ACCESS_DIRECT,
				URL:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			query := datasources.GetDataSourcesByTypeQuery{Type: datasources.DS_ES}

			dataSources, err := ss.GetDataSourcesByType(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, 1, len(dataSources))
		})

		t.Run("Returns an error if no type specified", func(t *testing.T) {
			db := db.InitTestDB(t)
			ss := SqlStore{db: db}

			query := datasources.GetDataSourcesByTypeQuery{}

			_, err := ss.GetDataSourcesByType(context.Background(), &query)

			require.Error(t, err)
		})
	})
}

func TestIntegrationGetDefaultDataSource(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("should return error if there is no default datasource", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := SqlStore{db: db}

		cmd := datasources.AddDataSourceCommand{
			OrgID:  10,
			Name:   "nisse",
			Type:   datasources.DS_GRAPHITE,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
		}

		_, err := ss.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := datasources.GetDefaultDataSourceQuery{OrgID: 10}
		_, err = ss.GetDefaultDataSource(context.Background(), &query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, datasources.ErrDataSourceNotFound))
	})

	t.Run("should return default datasource if exists", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := SqlStore{db: db}

		cmd := datasources.AddDataSourceCommand{
			OrgID:     10,
			Name:      "default datasource",
			Type:      datasources.DS_GRAPHITE,
			Access:    datasources.DS_ACCESS_DIRECT,
			URL:       "http://test",
			IsDefault: true,
		}

		_, err := ss.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := datasources.GetDefaultDataSourceQuery{OrgID: 10}
		dataSource, err := ss.GetDefaultDataSource(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, "default datasource", dataSource.Name)
	})

	t.Run("should not return default datasource of other organisation", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := SqlStore{db: db}
		query := datasources.GetDefaultDataSourceQuery{OrgID: 1}
		_, err := ss.GetDefaultDataSource(context.Background(), &query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, datasources.ErrDataSourceNotFound))
	})
}
