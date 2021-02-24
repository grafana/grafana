// +build integration

package sqlstore

import (
	"errors"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataAccess(t *testing.T) {
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

	initDatasource := func() *models.DataSource {
		cmd := defaultAddDatasourceCommand
		err := AddDataSource(&cmd)
		require.NoError(t, err)

		query := models.GetDataSourcesQuery{OrgId: 10}
		err = GetDataSources(&query)
		require.NoError(t, err)
		require.Equal(t, 1, len(query.Result))

		return query.Result[0]
	}

	t.Run("AddDataSource", func(t *testing.T) {
		t.Run("Can add datasource", func(t *testing.T) {
			InitTestDB(t)

			err := AddDataSource(&models.AddDataSourceCommand{
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
			err = GetDataSources(&query)
			require.NoError(t, err)

			require.Equal(t, 1, len(query.Result))
			ds := query.Result[0]

			require.EqualValues(t, 10, ds.OrgId)
			require.Equal(t, "site", ds.Database)
			require.True(t, ds.ReadOnly)
		})

		t.Run("generates uid if not specified", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			require.NotEmpty(t, ds.Uid)
		})

		t.Run("fails to insert ds with same uid", func(t *testing.T) {
			InitTestDB(t)
			cmd1 := defaultAddDatasourceCommand
			cmd2 := defaultAddDatasourceCommand
			cmd1.Uid = "test"
			cmd2.Uid = "test"
			err := AddDataSource(&cmd1)
			require.NoError(t, err)
			err = AddDataSource(&cmd2)
			require.Error(t, err)
			require.IsType(t, models.ErrDataSourceUidExists, err)
		})
	})

	t.Run("UpdateDataSource", func(t *testing.T) {
		t.Run("updates datasource with version", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			cmd := defaultUpdateDatasourceCommand
			cmd.Id = ds.Id
			cmd.Version = ds.Version
			err := UpdateDataSource(&cmd)
			require.NoError(t, err)
		})

		t.Run("does not overwrite Uid if not specified", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			require.NotEmpty(t, ds.Uid)

			cmd := defaultUpdateDatasourceCommand
			cmd.Id = ds.Id
			err := UpdateDataSource(&cmd)
			require.NoError(t, err)

			query := models.GetDataSourceQuery{Id: ds.Id, OrgId: 10}
			err = GetDataSource(&query)
			require.NoError(t, err)
			require.Equal(t, ds.Uid, query.Result.Uid)
		})

		t.Run("prevents update if version changed", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

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

			err := UpdateDataSource(&cmd)
			require.NoError(t, err)

			err = UpdateDataSource(&cmd2)
			require.Error(t, err)
		})

		t.Run("updates ds without version specified", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			cmd := &models.UpdateDataSourceCommand{
				Id:     ds.Id,
				OrgId:  10,
				Name:   "nisse",
				Type:   models.DS_GRAPHITE,
				Access: models.DS_ACCESS_PROXY,
				Url:    "http://test",
			}

			err := UpdateDataSource(cmd)
			require.NoError(t, err)
		})

		t.Run("updates ds without higher version", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			cmd := &models.UpdateDataSourceCommand{
				Id:      ds.Id,
				OrgId:   10,
				Name:    "nisse",
				Type:    models.DS_GRAPHITE,
				Access:  models.DS_ACCESS_PROXY,
				Url:     "http://test",
				Version: 90000,
			}

			err := UpdateDataSource(cmd)
			require.NoError(t, err)
		})
	})

	t.Run("DeleteDataSourceById", func(t *testing.T) {
		t.Run("can delete datasource", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			err := DeleteDataSource(&models.DeleteDataSourceCommand{ID: ds.Id, OrgID: ds.OrgId})
			require.NoError(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			require.NoError(t, err)

			require.Equal(t, 0, len(query.Result))
		})

		t.Run("Can not delete datasource with wrong orgId", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			err := DeleteDataSource(&models.DeleteDataSourceCommand{ID: ds.Id, OrgID: 123123})
			require.NoError(t, err)
			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			require.NoError(t, err)

			require.Equal(t, 1, len(query.Result))
		})
	})

	t.Run("DeleteDataSourceByName", func(t *testing.T) {
		InitTestDB(t)
		ds := initDatasource()
		query := models.GetDataSourcesQuery{OrgId: 10}

		err := DeleteDataSource(&models.DeleteDataSourceCommand{Name: ds.Name, OrgID: ds.OrgId})
		require.NoError(t, err)

		err = GetDataSources(&query)
		require.NoError(t, err)

		require.Equal(t, 0, len(query.Result))
	})

	t.Run("GetDataSource", func(t *testing.T) {
		t.Run("Number of data sources returned limited to 6 per organization", func(t *testing.T) {
			InitTestDB(t)
			datasourceLimit := 6
			for i := 0; i < datasourceLimit+1; i++ {
				err := AddDataSource(&models.AddDataSourceCommand{
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

			err := GetDataSources(&query)

			require.NoError(t, err)
			require.Equal(t, datasourceLimit, len(query.Result))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is not set", func(t *testing.T) {
			InitTestDB(t)
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				err := AddDataSource(&models.AddDataSourceCommand{
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

			err := GetDataSources(&query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(query.Result))
		})

		t.Run("No limit should be applied on the returned data sources if the limit is negative", func(t *testing.T) {
			InitTestDB(t)
			numberOfDatasource := 5100
			for i := 0; i < numberOfDatasource; i++ {
				err := AddDataSource(&models.AddDataSourceCommand{
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

			err := GetDataSources(&query)

			require.NoError(t, err)
			require.Equal(t, numberOfDatasource, len(query.Result))
		})
	})
}

func TestGetDefaultDataSource(t *testing.T) {
	InitTestDB(t)

	t.Run("should return error if there is no default datasource", func(t *testing.T) {
		cmd := models.AddDataSourceCommand{
			OrgId:  10,
			Name:   "nisse",
			Type:   models.DS_GRAPHITE,
			Access: models.DS_ACCESS_DIRECT,
			Url:    "http://test",
		}

		err := AddDataSource(&cmd)
		require.NoError(t, err)

		query := models.GetDefaultDataSourceQuery{OrgId: 10}
		err = GetDefaultDataSource(&query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrDataSourceNotFound))
	})

	t.Run("should return default datasource if exists", func(t *testing.T) {
		cmd := models.AddDataSourceCommand{
			OrgId:     10,
			Name:      "default datasource",
			Type:      models.DS_GRAPHITE,
			Access:    models.DS_ACCESS_DIRECT,
			Url:       "http://test",
			IsDefault: true,
		}

		err := AddDataSource(&cmd)
		require.NoError(t, err)

		query := models.GetDefaultDataSourceQuery{OrgId: 10}
		err = GetDefaultDataSource(&query)
		require.NoError(t, err)
		assert.Equal(t, "default datasource", query.Result.Name)
	})

	t.Run("should not return default datasource of other organisation", func(t *testing.T) {
		query := models.GetDefaultDataSourceQuery{OrgId: 1}
		err := GetDefaultDataSource(&query)
		require.Error(t, err)
		assert.True(t, errors.Is(err, models.ErrDataSourceNotFound))
	})
}
