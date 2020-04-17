package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestDataAccess(t *testing.T) {
	defaultAddDatasourceCommad := models.AddDataSourceCommand{
		OrgId:  10,
		Name:   "nisse",
		Type:   models.DS_GRAPHITE,
		Access: models.DS_ACCESS_DIRECT,
		Url:    "http://test",
	}

	defaultUpdateDatasourceCommad := models.UpdateDataSourceCommand{
		OrgId:  10,
		Name:   "nisse_updated",
		Type:   models.DS_GRAPHITE,
		Access: models.DS_ACCESS_DIRECT,
		Url:    "http://test",
	}

	initDatasource := func() *models.DataSource {
		cmd := defaultAddDatasourceCommad
		err := AddDataSource(&cmd)
		assert.Nil(t, err)

		query := models.GetDataSourcesQuery{OrgId: 10}
		err = GetDataSources(&query)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(query.Result))

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
			assert.Nil(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			assert.Nil(t, err)
			assert.Equal(t, 1, len(query.Result))
			ds := query.Result[0]

			assert.EqualValues(t, 10, ds.OrgId)
			assert.Equal(t, "site", ds.Database)
			assert.True(t, ds.ReadOnly)
		})

		t.Run("generates uid if not specified", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			assert.NotEmpty(t, ds.Uid)
		})

		t.Run("fails to insert ds with same uid", func(t *testing.T) {
			InitTestDB(t)
			cmd1 := defaultAddDatasourceCommad
			cmd2 := defaultAddDatasourceCommad
			cmd1.Uid = "test"
			cmd2.Uid = "test"
			err := AddDataSource(&cmd1)
			assert.Nil(t, err)
			err = AddDataSource(&cmd2)
			assert.NotNil(t, err)
			assert.IsType(t, models.ErrDataSourceUidExists, err)
		})
	})

	t.Run("UpdateDataSource", func(t *testing.T) {
		t.Run("updates datasource with version", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			cmd := defaultUpdateDatasourceCommad
			cmd.Id = ds.Id
			cmd.Version = ds.Version
			err := UpdateDataSource(&cmd)
			assert.Nil(t, err)
		})

		t.Run("does not overwrite Uid if not specified", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()
			assert.NotEmpty(t, ds.Uid)

			cmd := defaultUpdateDatasourceCommad
			cmd.Id = ds.Id
			err := UpdateDataSource(&cmd)
			assert.Nil(t, err)

			query := models.GetDataSourceByIdQuery{Id: ds.Id}
			err = GetDataSourceById(&query)
			assert.Nil(t, err)
			assert.Equal(t, ds.Uid, query.Result.Uid)
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
			assert.Nil(t, err)

			err = UpdateDataSource(&cmd2)
			assert.NotNil(t, err)
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
			assert.Nil(t, err)
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
			assert.Nil(t, err)
		})
	})

	t.Run("DeleteDataSourceById", func(t *testing.T) {
		t.Run("can delete datasource", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			err := DeleteDataSourceById(&models.DeleteDataSourceByIdCommand{Id: ds.Id, OrgId: ds.OrgId})
			assert.Nil(t, err)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			assert.Nil(t, err)

			assert.Equal(t, 0, len(query.Result))
		})

		t.Run("Can not delete datasource with wrong orgId", func(t *testing.T) {
			InitTestDB(t)
			ds := initDatasource()

			err := DeleteDataSourceById(&models.DeleteDataSourceByIdCommand{Id: ds.Id, OrgId: 123123})
			assert.Nil(t, err)
			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			assert.Nil(t, err)

			assert.Equal(t, 1, len(query.Result))
		})
	})

	t.Run("DeleteDataSourceByName", func(t *testing.T) {
		InitTestDB(t)
		ds := initDatasource()
		query := models.GetDataSourcesQuery{OrgId: 10}

		err := DeleteDataSourceByName(&models.DeleteDataSourceByNameCommand{Name: ds.Name, OrgId: ds.OrgId})
		assert.Nil(t, err)

		err = GetDataSources(&query)
		assert.Nil(t, err)

		assert.Equal(t, 0, len(query.Result))
	})
}
