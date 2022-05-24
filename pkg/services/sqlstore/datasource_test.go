//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationDataAccess(t *testing.T) {
	defaultAddDatasourceCommand := models.AddDataSourceCommand{
		OrgId:  10,
		Name:   "nisse",
		Type:   models.DS_GRAPHITE,
		Access: models.DS_ACCESS_DIRECT,
		Url:    "http://test",
	}

	defaultUpdateDatasourceCommand := models.UpdateDataSourceCommand{
		OrgId:  10,
		Name:   "nisse_updated",
		Type:   models.DS_GRAPHITE,
		Access: models.DS_ACCESS_DIRECT,
		Url:    "http://test",
	}

	initDatasource := func(sqlStore *SQLStore) *models.DataSource {
		cmd := defaultAddDatasourceCommand
		err := sqlStore.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := models.GetDataSourcesQuery{OrgId: 10}
		err = sqlStore.GetDataSources(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, 1, len(query.Result))

		return query.Result[0]
	}

	t.Run("AddDataSource", func(t *testing.T) {
		t.Run("Can add datasource", func(t *testing.T) {
			sqlStore := InitTestDB(t)

			err := sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
				OrgId:    10,
				Name:     "laban",
				Type:     models.DS_GRAPHITE,
				Access:   models.DS_ACCESS_DIRECT,
				Url:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = sqlStore.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 1, len(query.Result))
			ds := query.Result[0]

			require.EqualValues(t, 10, ds.OrgId)
			require.Equal(t, "site", ds.Database)
			require.True(t, ds.ReadOnly)
		})

		t.Run("generates uid if not specified", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)
			require.NotEmpty(t, ds.Uid)
		})

		t.Run("fails to insert ds with same uid", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			cmd1 := defaultAddDatasourceCommand
			cmd2 := defaultAddDatasourceCommand
			cmd1.Uid = "test"
			cmd2.Uid = "test"
			err := sqlStore.AddDataSource(context.Background(), &cmd1)
			require.NoError(t, err)
			err = sqlStore.AddDataSource(context.Background(), &cmd2)
			require.Error(t, err)
			require.IsType(t, models.ErrDataSourceUidExists, err)
		})

		t.Run("fires an event when the datasource is added", func(t *testing.T) {
			sqlStore := InitTestDB(t)

			var created *events.DataSourceCreated
			bus.AddEventListener(func(ctx context.Context, e *events.DataSourceCreated) error {
				created = e
				return nil
			})

			err := sqlStore.AddDataSource(context.Background(), &defaultAddDatasourceCommand)
			require.NoError(t, err)

			require.Eventually(t, func() bool {
				return assert.NotNil(t, created)
			}, time.Second, time.Millisecond)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = sqlStore.GetDataSources(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, 1, len(query.Result))

			require.Equal(t, query.Result[0].Id, created.ID)
			require.Equal(t, query.Result[0].Uid, created.UID)
			require.Equal(t, int64(10), created.OrgID)
			require.Equal(t, "nisse", created.Name)
		})
	})

	t.Run("UpdateDataSource", func(t *testing.T) {
		t.Run("updates datasource with version", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)
			cmd := defaultUpdateDatasourceCommand
			cmd.Id = ds.Id
			cmd.Version = ds.Version
			err := sqlStore.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)
		})

		t.Run("does not overwrite Uid if not specified", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)
			require.NotEmpty(t, ds.Uid)

			cmd := defaultUpdateDatasourceCommand
			cmd.Id = ds.Id
			err := sqlStore.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)

			query := models.GetDataSourceQuery{Id: ds.Id, OrgId: 10}
			err = sqlStore.GetDataSource(context.Background(), &query)
			require.NoError(t, err)
			require.Equal(t, ds.Uid, query.Result.Uid)
		})

		t.Run("prevents update if version changed", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)

			cmd := models.UpdateDataSourceCommand{
				Id:      ds.Id,
				OrgId:   10,
				Name:    "nisse",
				Type:    models.DS_GRAPHITE,
				Access:  models.DS_ACCESS_PROXY,
				Url:     "http://test",
				Version: ds.Version,
			}
			// Make a copy as UpdateDataSource modifies it
			cmd2 := cmd

			err := sqlStore.UpdateDataSource(context.Background(), &cmd)
			require.NoError(t, err)

			err = sqlStore.UpdateDataSource(context.Background(), &cmd2)
			require.Error(t, err)
		})

		t.Run("updates ds without version specified", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)

			cmd := &models.UpdateDataSourceCommand{
				Id:     ds.Id,
				OrgId:  10,
				Name:   "nisse",
				Type:   models.DS_GRAPHITE,
				Access: models.DS_ACCESS_PROXY,
				Url:    "http://test",
			}

			err := sqlStore.UpdateDataSource(context.Background(), cmd)
			require.NoError(t, err)
		})

		t.Run("updates ds without higher version", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)

			cmd := &models.UpdateDataSourceCommand{
				Id:      ds.Id,
				OrgId:   10,
				Name:    "nisse",
				Type:    models.DS_GRAPHITE,
				Access:  models.DS_ACCESS_PROXY,
				Url:     "http://test",
				Version: 90000,
			}

			err := sqlStore.UpdateDataSource(context.Background(), cmd)
			require.NoError(t, err)
		})
	})

	t.Run("DeleteDataSourceById", func(t *testing.T) {
		t.Run("can delete datasource", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)

			err := sqlStore.DeleteDataSource(context.Background(), &models.DeleteDataSourceCommand{ID: ds.Id, OrgID: ds.OrgId})
			require.NoError(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = sqlStore.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 0, len(query.Result))
		})

		t.Run("Can not delete datasource with wrong orgId", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			ds := initDatasource(sqlStore)

			err := sqlStore.DeleteDataSource(context.Background(),
				&models.DeleteDataSourceCommand{ID: ds.Id, OrgID: 123123})
			require.NoError(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = sqlStore.GetDataSources(context.Background(), &query)
			require.NoError(t, err)

			require.Equal(t, 1, len(query.Result))
		})
	})

	t.Run("fires an event when the datasource is deleted", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		ds := initDatasource(sqlStore)

		var deleted *events.DataSourceDeleted
		bus.AddEventListener(func(ctx context.Context, e *events.DataSourceDeleted) error {
			deleted = e
			return nil
		})

		err := sqlStore.DeleteDataSource(context.Background(),
			&models.DeleteDataSourceCommand{ID: ds.Id, UID: "nisse-uid", Name: "nisse", OrgID: int64(123123)})
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			return assert.NotNil(t, deleted)
		}, time.Second, time.Millisecond)

		require.Equal(t, ds.Id, deleted.ID)
		require.Equal(t, int64(123123), deleted.OrgID)
		require.Equal(t, "nisse", deleted.Name)
		require.Equal(t, "nisse-uid", deleted.UID)
	})

	t.Run("DeleteDataSourceByName", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		ds := initDatasource(sqlStore)
		query := models.GetDataSourcesQuery{OrgId: 10}

		err := sqlStore.DeleteDataSource(context.Background(), &models.DeleteDataSourceCommand{Name: ds.Name, OrgID: ds.OrgId})
		require.NoError(t, err)

		err = sqlStore.GetDataSources(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, 0, len(query.Result))
	})

	t.Run("DeleteDataSourceAccessControlPermissions", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		ds := initDatasource(sqlStore)

		// Init associated permission
		errAddPermissions := sqlStore.WithTransactionalDbSession(context.TODO(), func(sess *DBSession) error {
			_, err := sess.Table("permission").Insert(ac.Permission{
				RoleID:  1,
				Action:  "datasources:read",
				Scope:   ac.Scope("datasources", "id", fmt.Sprintf("%d", ds.Id)),
				Updated: time.Now(),
				Created: time.Now(),
			})
			return err
		})
		require.NoError(t, errAddPermissions)
		query := models.GetDataSourcesQuery{OrgId: 10}

		errDeletingDS := sqlStore.DeleteDataSource(context.Background(),
			&models.DeleteDataSourceCommand{Name: ds.Name, OrgID: ds.OrgId},
		)
		require.NoError(t, errDeletingDS)

		// Check associated permission
		permCount := int64(0)
		errGetPermissions := sqlStore.WithTransactionalDbSession(context.TODO(), func(sess *DBSession) error {
			var err error
			permCount, err = sess.Table("permission").Count()
			return err
		})
		require.NoError(t, errGetPermissions)
		require.Zero(t, permCount, "permissions associated to the data source should have been removed")

		require.Equal(t, 0, len(query.Result))
	})

	t.Run("GetDataSources", func(t *testing.T) {
		t.Run("Number of data sources returned limited to 6 per organization", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			datasourceLimit := 6
			for i := 0; i < datasourceLimit+1; i++ {
				err := sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
					OrgId:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     models.DS_GRAPHITE,
					Access:   models.DS_ACCESS_DIRECT,
					Url:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := models.GetDataSourcesQuery{OrgId: 10, DataSourceLimit: datasourceLimit}

			err := sqlStore.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, datasourceLimit, len(query.Result))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is not set", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				err := sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
					OrgId:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     models.DS_GRAPHITE,
					Access:   models.DS_ACCESS_DIRECT,
					Url:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := models.GetDataSourcesQuery{OrgId: 10}

			err := sqlStore.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(query.Result))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is negative", func(t *testing.T) {
			sqlStore := InitTestDB(t)
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				err := sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
					OrgId:    10,
					Name:     "laban" + strconv.Itoa(i),
					Type:     models.DS_GRAPHITE,
					Access:   models.DS_ACCESS_DIRECT,
					Url:      "http://test",
					Database: "site",
					ReadOnly: true,
				})
				require.NoError(t, err)
			}
			query := models.GetDataSourcesQuery{OrgId: 10, DataSourceLimit: -1}

			err := sqlStore.GetDataSources(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(query.Result))
		})
	})

	t.Run("GetDataSourcesByType", func(t *testing.T) {
		t.Run("Only returns datasources of specified type", func(t *testing.T) {
			sqlStore := InitTestDB(t)

			err := sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
				OrgId:    10,
				Name:     "Elasticsearch",
				Type:     models.DS_ES,
				Access:   models.DS_ACCESS_DIRECT,
				Url:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			err = sqlStore.AddDataSource(context.Background(), &models.AddDataSourceCommand{
				OrgId:    10,
				Name:     "Graphite",
				Type:     models.DS_GRAPHITE,
				Access:   models.DS_ACCESS_DIRECT,
				Url:      "http://test",
				Database: "site",
				ReadOnly: true,
			})
			require.NoError(t, err)

			query := models.GetDataSourcesByTypeQuery{Type: models.DS_ES}

			err = sqlStore.GetDataSourcesByType(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, 1, len(query.Result))
		})

		t.Run("Returns an error if no type specified", func(t *testing.T) {
			sqlStore := InitTestDB(t)

			query := models.GetDataSourcesByTypeQuery{}

			err := sqlStore.GetDataSourcesByType(context.Background(), &query)

			require.Error(t, err)
		})
	})
}

func TestIntegrationGetDefaultDataSource(t *testing.T) {
	InitTestDB(t)

	t.Run("should return error if there is no default datasource", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		cmd := models.AddDataSourceCommand{
			OrgId:  10,
			Name:   "nisse",
			Type:   models.DS_GRAPHITE,
			Access: models.DS_ACCESS_DIRECT,
			Url:    "http://test",
		}

		err := sqlStore.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := models.GetDefaultDataSourceQuery{OrgId: 10}
		err = sqlStore.GetDefaultDataSource(context.Background(), &query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrDataSourceNotFound))
	})

	t.Run("should return default datasource if exists", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		cmd := models.AddDataSourceCommand{
			OrgId:     10,
			Name:      "default datasource",
			Type:      models.DS_GRAPHITE,
			Access:    models.DS_ACCESS_DIRECT,
			Url:       "http://test",
			IsDefault: true,
		}

		err := sqlStore.AddDataSource(context.Background(), &cmd)
		require.NoError(t, err)

		query := models.GetDefaultDataSourceQuery{OrgId: 10}
		err = sqlStore.GetDefaultDataSource(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, "default datasource", query.Result.Name)
	})

	t.Run("should not return default datasource of other organisation", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		query := models.GetDefaultDataSourceQuery{OrgId: 1}
		err := sqlStore.GetDefaultDataSource(context.Background(), &query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrDataSourceNotFound))
	})
}
