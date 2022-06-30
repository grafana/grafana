package service

import (
	"context"
	"testing"
	"time"

	"github.com/gofrs/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var timeSettings, _ = simplejson.NewJson([]byte(`{"from": "now-12", "to": "now"}`))
var defaultPubdashTimeSettings, _ = simplejson.NewJson([]byte(`{}`))
var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-8", "to": "now"}})
var mergedDashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-12", "to": "now"}})

func TestGetPublicDashboard(t *testing.T) {
	type storeResp struct {
		pd  *models.PublicDashboard
		d   *models.Dashboard
		err error
	}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *models.Dashboard
	}{
		{
			Name:        "returns a dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: true},
				d:   &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "puts pubdash time settings into dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: true, TimeSettings: timeSettings},
				d:   &models.Dashboard{Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &models.Dashboard{Data: mergedDashboardData},
		},
		{
			Name:        "returns ErrPublicDashboardNotFound when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: false},
				d:   &models.Dashboard{Uid: "mydashboard"},
				err: nil,
			},
			ErrResp:  dashboards.ErrPublicDashboardNotFound,
			DashResp: nil,
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if PublicDashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     dashboards.ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if Dashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     dashboards.ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := dashboards.FakeDashboardStore{}
			service := &DashboardServiceImpl{
				log:            log.New("test.logger"),
				dashboardStore: &fakeStore,
			}

			fakeStore.On("GetPublicDashboard", mock.Anything, mock.Anything).
				Return(test.StoreResp.pd, test.StoreResp.d, test.StoreResp.err)

			dashboard, err := service.GetPublicDashboard(context.Background(), test.AccessToken)
			if test.ErrResp != nil {
				assert.Error(t, test.ErrResp, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, test.DashResp, dashboard)

			if test.DashResp != nil {
				assert.NotNil(t, dashboard.CreatedBy)
			}
		})
	}
}

func TestSavePublicDashboard(t *testing.T) {
	t.Run("Saving public dashboard", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		service := &DashboardServiceImpl{
			log:            log.New("test.logger"),
			dashboardStore: dashboardStore,
		}

		dto := &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &models.PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
				TimeSettings: timeSettings,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		pubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		// DashboardUid/OrgId/CreatedBy set by the command, not parameters
		assert.Equal(t, dashboard.Uid, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgId, pubdash.OrgId)
		assert.Equal(t, dto.UserId, pubdash.CreatedBy)
		// IsEnabled set by parameters
		assert.Equal(t, dto.PublicDashboard.IsEnabled, pubdash.IsEnabled)
		// CreatedAt set to non-zero time
		assert.NotEqual(t, &time.Time{}, pubdash.CreatedAt)
		// Time settings set by db
		assert.Equal(t, timeSettings, pubdash.TimeSettings)
		// accessToken is valid uuid
		_, err = uuid.FromString(pubdash.AccessToken)
		require.NoError(t, err)
	})

	t.Run("Validate pubdash has default time setting value", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		service := &DashboardServiceImpl{
			log:            log.New("test.logger"),
			dashboardStore: dashboardStore,
		}

		dto := &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &models.PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		pubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, defaultPubdashTimeSettings, pubdash.TimeSettings)
	})

	t.Run("PLACEHOLDER - dashboard with template variables cannot be saved", func(t *testing.T) {})
}

func TestUpdatePublicDashboard(t *testing.T) {
	t.Run("Updating public dashboard", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		service := &DashboardServiceImpl{
			log:            log.New("test.logger"),
			dashboardStore: dashboardStore,
		}

		dto := &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &models.PublicDashboard{
				IsEnabled:    true,
				TimeSettings: timeSettings,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		savedPubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       8,
			PublicDashboard: &models.PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:    true,
				TimeSettings: timeSettings,
				AccessToken:  "NOTAREALUUID",
			},
		}

		// Since the dto.PublicDashboard has a uid, this will call
		// service.updatePublicDashboardConfig
		_, err = service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		updatedPubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		// don't get updated
		assert.Equal(t, savedPubdash.DashboardUid, updatedPubdash.DashboardUid)
		assert.Equal(t, savedPubdash.OrgId, updatedPubdash.OrgId)
		assert.Equal(t, savedPubdash.CreatedAt, updatedPubdash.CreatedAt)
		assert.Equal(t, savedPubdash.CreatedBy, updatedPubdash.CreatedBy)
		assert.Equal(t, savedPubdash.AccessToken, updatedPubdash.AccessToken)

		// gets updated
		assert.Equal(t, dto.PublicDashboard.IsEnabled, updatedPubdash.IsEnabled)
		assert.Equal(t, dto.PublicDashboard.TimeSettings, updatedPubdash.TimeSettings)
		assert.Equal(t, dto.UserId, updatedPubdash.UpdatedBy)
		assert.NotEqual(t, &time.Time{}, updatedPubdash.UpdatedAt)
	})

	t.Run("Updating set empty time settings", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		service := &DashboardServiceImpl{
			log:            log.New("test.logger"),
			dashboardStore: dashboardStore,
		}

		dto := &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &models.PublicDashboard{
				IsEnabled:    true,
				TimeSettings: timeSettings,
			},
		}

		// Since the dto.PublicDashboard has a uid, this will call
		// service.updatePublicDashboardConfig
		_, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		savedPubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &dashboards.SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       8,
			PublicDashboard: &models.PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:   true,
				AccessToken: "NOTAREALUUID",
			},
		}

		_, err = service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		updatedPubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		timeSettings, err := simplejson.NewJson([]byte("{}"))
		require.NoError(t, err)

		assert.Equal(t, timeSettings, updatedPubdash.TimeSettings)
	})
}

func TestBuildPublicDashboardMetricRequest(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := database.ProvideDashboardStore(sqlStore)
	publicDashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	nonPublicDashboard := insertTestDashboard(t, dashboardStore, "testNonPublicDashie", 1, 0, true)

	service := &DashboardServiceImpl{
		log:            log.New("test.logger"),
		dashboardStore: dashboardStore,
	}

	dto := &dashboards.SavePublicDashboardConfigDTO{
		DashboardUid: publicDashboard.Uid,
		OrgId:        publicDashboard.OrgId,
		PublicDashboard: &models.PublicDashboard{
			IsEnabled:    true,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: timeSettings,
		},
	}

	publicDashboardPD, err := service.SavePublicDashboardConfig(context.Background(), dto)
	require.NoError(t, err)

	nonPublicDto := &dashboards.SavePublicDashboardConfigDTO{
		DashboardUid: nonPublicDashboard.Uid,
		OrgId:        nonPublicDashboard.OrgId,
		PublicDashboard: &models.PublicDashboard{
			IsEnabled:    false,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: defaultPubdashTimeSettings,
		},
	}

	nonPublicDashboardPD, err := service.SavePublicDashboardConfig(context.Background(), nonPublicDto)
	require.NoError(t, err)

	t.Run("extracts queries from provided dashboard", func(t *testing.T) {
		reqDTO, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			publicDashboard,
			publicDashboardPD,
			1,
		)
		require.NoError(t, err)

		require.Equal(t, timeSettings.Get("from").MustString(), reqDTO.From)
		require.Equal(t, timeSettings.Get("to").MustString(), reqDTO.To)
		require.Len(t, reqDTO.Queries, 2)
		require.Equal(
			t,
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"refId": "A"
			}`)),
			reqDTO.Queries[0],
		)
		require.Equal(
			t,
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "prometheus",
					"uid": "ds2"
				},
				"refId": "B"
			}`)),
			reqDTO.Queries[1],
		)
	})

	t.Run("returns an error when panel missing", func(t *testing.T) {
		_, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			publicDashboard,
			publicDashboardPD,
			49,
		)

		require.ErrorContains(t, err, "Panel not found")
	})

	t.Run("returns an error when dashboard not public", func(t *testing.T) {
		_, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			nonPublicDashboard,
			nonPublicDashboardPD,
			2,
		)
		require.ErrorContains(t, err, "Public dashboard not found")
	})
}

func insertTestDashboard(t *testing.T, dashboardStore *database.DashboardStore, title string, orgId int64,
	folderId int64, isFolder bool, tags ...interface{}) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
			"panels": []interface{}{
				map[string]interface{}{
					"id": 1,
					"targets": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type": "mysql",
								"uid":  "ds1",
							},
							"refId": "A",
						},
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type": "prometheus",
								"uid":  "ds2",
							},
							"refId": "B",
						},
					},
				},
				map[string]interface{}{
					"id": 2,
					"targets": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type": "mysql",
								"uid":  "ds3",
							},
							"refId": "C",
						},
					},
				},
			},
		}),
	}
	dash, err := dashboardStore.SaveDashboard(cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)
	return dash
}
