package service

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
		name      string
		uid       string
		storeResp *storeResp
		errResp   error
		dashResp  *models.Dashboard
	}{
		{
			name: "returns a dashboard",
			uid:  "abc123",
			storeResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: true},
				d:   &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
				err: nil,
			},
			errResp:  nil,
			dashResp: &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
		},
		{
			name: "puts pubdash time settings into dashboard",
			uid:  "abc123",
			storeResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: true, TimeSettings: timeSettings},
				d:   &models.Dashboard{Data: dashboardData},
				err: nil,
			},
			errResp:  nil,
			dashResp: &models.Dashboard{Data: mergedDashboardData},
		},
		{
			name: "returns ErrPublicDashboardNotFound when isEnabled is false",
			uid:  "abc123",
			storeResp: &storeResp{
				pd:  &models.PublicDashboard{IsEnabled: false},
				d:   &models.Dashboard{Uid: "mydashboard"},
				err: nil,
			},
			errResp:  models.ErrPublicDashboardNotFound,
			dashResp: nil,
		},
		{
			name:      "returns ErrPublicDashboardNotFound if PublicDashboard missing",
			uid:       "abc123",
			storeResp: &storeResp{pd: nil, d: nil, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
		},
		{
			name:      "returns ErrPublicDashboardNotFound if Dashboard missing",
			uid:       "abc123",
			storeResp: &storeResp{pd: nil, d: nil, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			fakeStore := dashboards.FakeDashboardStore{}
			service := &DashboardServiceImpl{
				log:            log.New("test.logger"),
				dashboardStore: &fakeStore,
			}

			fakeStore.On("GetPublicDashboard", mock.Anything, mock.Anything).
				Return(test.storeResp.pd, test.storeResp.d, test.storeResp.err)

			dashboard, err := service.GetPublicDashboard(context.Background(), test.uid)
			if test.errResp != nil {
				assert.Error(t, test.errResp, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, test.dashResp, dashboard)

			if test.dashResp != nil {
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
			},
		}

		_, err = service.updatePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		updatedPubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)

		// don't get updated
		assert.Equal(t, savedPubdash.DashboardUid, updatedPubdash.DashboardUid)
		assert.Equal(t, savedPubdash.OrgId, updatedPubdash.OrgId)
		assert.Equal(t, savedPubdash.CreatedAt, updatedPubdash.CreatedAt)
		assert.Equal(t, savedPubdash.CreatedBy, updatedPubdash.CreatedBy)

		// gets updated
		assert.Equal(t, dto.PublicDashboard.IsEnabled, updatedPubdash.IsEnabled)
		assert.Equal(t, dto.PublicDashboard.TimeSettings, updatedPubdash.TimeSettings)
		assert.Equal(t, dto.UserId, updatedPubdash.UpdatedBy)
		assert.NotEqual(t, &time.Time{}, updatedPubdash.UpdatedAt)
	})
}

func TestBuildPublicDashboardMetricRequest(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := database.ProvideDashboardStore(sqlStore)
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	nonPublicDashboard := insertTestDashboard(t, dashboardStore, "testNonPublicDashie", 1, 0, true)

	service := &DashboardServiceImpl{
		log:            log.New("test.logger"),
		dashboardStore: dashboardStore,
	}

	dto := &dashboards.SavePublicDashboardConfigDTO{
		DashboardUid: dashboard.Uid,
		OrgId:        dashboard.OrgId,
		PublicDashboard: &models.PublicDashboard{
			IsEnabled:    true,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: timeSettings,
		},
	}

	pubdash, err := service.SavePublicDashboardConfig(context.Background(), dto)
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

	_, err = service.SavePublicDashboardConfig(context.Background(), nonPublicDto)
	require.NoError(t, err)

	t.Run("extracts queries from provided dashboard", func(t *testing.T) {
		reqDTO, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			pubdash.Uid,
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
			pubdash.Uid,
			49,
		)

		require.ErrorContains(t, err, "Panel not found")
	})

	t.Run("returns an error when dashboard not public", func(t *testing.T) {
		_, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			nonPublicDashboard.Uid,
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
			"panels": []map[string]interface{}{
				{
					"id": 1,
					"targets": []map[string]interface{}{
						{
							"datasource": map[string]string{
								"type": "mysql",
								"uid":  "ds1",
							},
							"refId": "A",
						},
						{
							"datasource": map[string]string{
								"type": "prometheus",
								"uid":  "ds2",
							},
							"refId": "B",
						},
					},
				},
				{
					"id": 2,
					"targets": []map[string]interface{}{
						{
							"datasource": map[string]string{
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
