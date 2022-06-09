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
			name:      "returns a dashboard",
			uid:       "abc123",
			storeResp: &storeResp{pd: &models.PublicDashboard{IsEnabled: true}, d: &models.Dashboard{Uid: "mydashboard"}, err: nil},
			errResp:   nil,
			dashResp:  &models.Dashboard{Uid: "mydashboard"},
		},
		{
			name: "puts pubdash time settings into dashboard",
			uid:  "abc123",
			storeResp: &storeResp{
				pd: &models.PublicDashboard{TimeSettings: `{"from": "now-8", "to": "now"}`},
				d: &models.Dashboard{
					IsPublic: true,
					Data:     simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "abc", "to": "123"}}),
				},
				err: nil},
			errResp:  nil,
			dashResp: &models.Dashboard{IsPublic: true, Data: simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-8", "to": "now"}})},
		},
		{
			name:      "returns ErrPublicDashboardNotFound when isPublic is false",
			uid:       "abc123",
			storeResp: &storeResp{pd: &models.PublicDashboard{IsEnabled: false}, d: &models.Dashboard{Uid: "mydashboard"}, err: nil},
			errResp:   models.ErrPublicDashboardNotFound,
			dashResp:  nil,
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
	t.Run("gets PublicDashboard.orgId and PublicDashboard.DashboardUid set from SavePublicDashboardConfigDTO", func(t *testing.T) {
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

		pdc, err := service.SavePublicDashboardConfig(context.Background(), dto)
		require.NoError(t, err)

		assert.Equal(t, dashboard.Uid, pdc.DashboardUid)
		assert.Equal(t, dashboard.OrgId, pdc.OrgId)
	})

	t.Run("PLACEHOLDER - dashboard with template variables cannot be saved", func(t *testing.T) {
		//sqlStore := sqlstore.InitTestDB(t)
		//dashboardStore := database.ProvideDashboardStore(sqlStore)
		//dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)

		//service := &DashboardServiceImpl{
		//log:            log.New("test.logger"),
		//dashboardStore: dashboardStore,
		//}

		//dto := &dashboards.SavePublicDashboardConfigDTO{
		//DashboardUid: dashboard.Uid,
		//OrgId:        dashboard.OrgId,
		//PublicDashboardConfig: &models.PublicDashboardConfig{
		//IsPublic: true,
		//PublicDashboard: models.PublicDashboard{
		//DashboardUid: "NOTTHESAME",
		//OrgId:        9999999,
		//},
		//},
		//}

		//pdc, err := service.SavePublicDashboardConfig(context.Background(), dto)
		//require.NoError(t, err)

		//assert.Equal(t, dashboard.Uid, pdc.PublicDashboard.DashboardUid)
		//assert.Equal(t, dashboard.OrgId, pdc.PublicDashboard.OrgId)
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
		PublicDashboardConfig: &models.PublicDashboardConfig{
			IsPublic: true,
			PublicDashboard: models.PublicDashboard{
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
				TimeSettings: `{"from": "FROM", "to": "TO"}`,
			},
		},
	}

	pdc, err := service.SavePublicDashboardConfig(context.Background(), dto)
	require.NoError(t, err)

	nonPublicDto := &dashboards.SavePublicDashboardConfigDTO{
		DashboardUid: nonPublicDashboard.Uid,
		OrgId:        nonPublicDashboard.OrgId,
		PublicDashboardConfig: &models.PublicDashboardConfig{
			IsPublic: false,
			PublicDashboard: models.PublicDashboard{
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
				TimeSettings: `{"from": "FROM", "to": "TO"}`,
			},
		},
	}

	nonPublicPdc, err := service.SavePublicDashboardConfig(context.Background(), nonPublicDto)
	require.NoError(t, err)

	t.Run("extracts queries from provided dashboard", func(t *testing.T) {
		reqDTO, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			pdc.PublicDashboard.Uid,
			1,
		)
		require.NoError(t, err)

		require.Equal(t, "FROM", reqDTO.From)
		require.Equal(t, "TO", reqDTO.To)
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
			pdc.PublicDashboard.Uid,
			49,
		)

		require.ErrorContains(t, err, "Panel not found")
	})

	t.Run("returns an error when dashboard not public", func(t *testing.T) {
		_, err := service.BuildPublicDashboardMetricRequest(
			context.Background(),
			nonPublicPdc.PublicDashboard.Uid,
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
