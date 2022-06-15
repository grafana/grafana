package service

import (
	"context"
	"testing"

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

var TimeSettings, _ = simplejson.NewJson([]byte(`{"from": "now-12", "to": "now"}`))
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
				pd:  &models.PublicDashboard{IsEnabled: true, TimeSettings: TimeSettings},
				d:   &models.Dashboard{Data: dashboardData},
				err: nil,
			},
			errResp:  nil,
			dashResp: &models.Dashboard{Data: mergedDashboardData},
		},
		{
			name: "returns ErrPublicDashboardNotFound when isPublic is false",
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
			fakeStore.On("GetPublicDashboard", mock.Anything).
				Return(test.storeResp.pd, test.storeResp.d, test.storeResp.err)

			dashboard, err := service.GetPublicDashboard(context.Background(), test.uid)
			if test.errResp != nil {
				assert.Error(t, test.errResp, err)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, test.dashResp, dashboard)
		})
	}
}

func TestSavePublicDashboard(t *testing.T) {
	t.Run("gets PublicDashboard.orgId and PublicDashboard.DashboardUid set from SavePublicDashboardDTO", func(t *testing.T) {
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
			PublicDashboard: &models.PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		pubdash, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		assert.Equal(t, dashboard.Uid, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgId, pubdash.OrgId)
	})

	t.Run("PLACEHOLDER - validate pubdash time variables", func(t *testing.T) {})
	t.Run("PLACEHOLDER - dashboard with template variables cannot be saved", func(t *testing.T) {
		//sqlStore := sqlstore.InitTestDB(t)
		//dashboardStore := database.ProvideDashboardStore(sqlStore)
		//dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		//service := &DashboardServiceImpl{
		//log:            log.New("test.logger"),
		//dashboardStore: dashboardStore,
		//}

		//dto := &dashboards.SavePublicDashboardDTO{
		//DashboardUid: dashboard.Uid,
		//OrgId:        dashboard.OrgId,
		//PublicDashboard: &models.PublicDashboard{
		//IsEnabled: true,
		//PublicDashboard: models.PublicDashboard{
		//DashboardUid: "NOTTHESAME",
		//OrgId:        9999999,
		//},
		//},
		//}

		//pdc, err := service.SavePublicDashboard(context.Background(), dto)
		//require.NoError(t, err)

		//assert.Equal(t, dashboard.Uid, pdc.PublicDashboard.DashboardUid)
		//assert.Equal(t, dashboard.OrgId, pdc.PublicDashboard.OrgId)
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
			TimeSettings: TimeSettings,
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
			TimeSettings: TimeSettings,
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

		require.Equal(t, TimeSettings.Get("from").MustString(), reqDTO.From)
		require.Equal(t, TimeSettings.Get("to").MustString(), reqDTO.To)
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
