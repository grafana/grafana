package service

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/database"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

var timeSettings, _ = simplejson.NewJson([]byte(`{"from": "now-12h", "to": "now"}`))
var defaultPubdashTimeSettings, _ = simplejson.NewJson([]byte(`{}`))
var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-8h", "to": "now"}})
var SignedInUser = &user.SignedInUser{UserID: 1234, Login: "user@login.com"}

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.service")
}

func TestGetPublicDashboard(t *testing.T) {
	type storeResp struct {
		pd  *PublicDashboard
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
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: true},
				d:   &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &models.Dashboard{Uid: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns ErrPublicDashboardNotFound when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: false},
				d:   &models.Dashboard{Uid: "mydashboard"},
				err: nil,
			},
			ErrResp:  ErrPublicDashboardNotFound,
			DashResp: nil,
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if PublicDashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
		{
			Name:        "returns ErrPublicDashboardNotFound if Dashboard missing",
			AccessToken: "abc123",
			StoreResp:   &storeResp{pd: nil, d: nil, err: nil},
			ErrResp:     ErrPublicDashboardNotFound,
			DashResp:    nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := FakePublicDashboardStore{}
			service := &PublicDashboardServiceImpl{
				log:   log.New("test.logger"),
				store: &fakeStore,
			}

			fakeStore.On("GetPublicDashboard", mock.Anything, mock.Anything).
				Return(test.StoreResp.pd, test.StoreResp.d, test.StoreResp.err)

			pdc, dash, err := service.GetPublicDashboard(context.Background(), test.AccessToken)
			if test.ErrResp != nil {
				assert.Error(t, test.ErrResp, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, test.DashResp, dash)

			if test.DashResp != nil {
				assert.NotNil(t, dash.CreatedBy)
				assert.Equal(t, test.StoreResp.pd, pdc)
			}
		})
	}
}

func TestSavePublicDashboard(t *testing.T) {
	t.Run("Saving public dashboard", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
				TimeSettings: timeSettings,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
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
		_, err = uuid.Parse(pubdash.AccessToken)
		require.NoError(t, err, "expected a valid UUID, got %s", pubdash.AccessToken)
	})

	t.Run("Validate pubdash has default time setting value", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.GetPublicDashboardConfig(context.Background(), dashboard.OrgId, dashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, defaultPubdashTimeSettings, pubdash.TimeSettings)
	})

	t.Run("Validate pubdash whose dashboard has template variables returns error", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore := database.ProvideStore(sqlStore)
		templateVars := make([]map[string]interface{}, 1)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, templateVars)

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
			},
		}

		_, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
		require.Error(t, err)
	})
}

func TestUpdatePublicDashboard(t *testing.T) {
	t.Run("Updating public dashboard", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				TimeSettings: timeSettings,
			},
		}

		savedPubdash, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       8,
			PublicDashboard: &PublicDashboard{
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
		updatedPubdash, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
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
		dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore := database.ProvideStore(sqlStore)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})

		service := &PublicDashboardServiceImpl{
			log:   log.New("test.logger"),
			store: publicdashboardStore,
		}

		dto := &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				TimeSettings: timeSettings,
			},
		}

		// Since the dto.PublicDashboard has a uid, this will call
		// service.updatePublicDashboardConfig
		savedPubdash, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// attempt to overwrite settings
		dto = &SavePublicDashboardConfigDTO{
			DashboardUid: dashboard.Uid,
			OrgId:        dashboard.OrgId,
			UserId:       8,
			PublicDashboard: &PublicDashboard{
				Uid:          savedPubdash.Uid,
				OrgId:        9,
				DashboardUid: "abc1234",
				CreatedBy:    9,
				CreatedAt:    time.Time{},

				IsEnabled:   true,
				AccessToken: "NOTAREALUUID",
			},
		}

		updatedPubdash, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		timeSettings, err := simplejson.NewJson([]byte("{}"))
		require.NoError(t, err)

		assert.Equal(t, timeSettings, updatedPubdash.TimeSettings)
	})
}

func TestBuildAnonymousUser(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})
	publicdashboardStore := database.ProvideStore(sqlStore)
	service := &PublicDashboardServiceImpl{
		log:   log.New("test.logger"),
		store: publicdashboardStore,
	}

	t.Run("will add datasource read and query permissions to user for each datasource in dashboard", func(t *testing.T) {
		user, err := service.BuildAnonymousUser(context.Background(), dashboard)
		require.NoError(t, err)
		require.Equal(t, dashboard.OrgId, user.OrgID)
		require.Equal(t, "datasources:uid:ds1", user.Permissions[user.OrgID]["datasources:query"][0])
		require.Equal(t, "datasources:uid:ds3", user.Permissions[user.OrgID]["datasources:query"][1])
		require.Equal(t, "datasources:uid:ds1", user.Permissions[user.OrgID]["datasources:read"][0])
		require.Equal(t, "datasources:uid:ds3", user.Permissions[user.OrgID]["datasources:read"][1])
	})
}

func TestGetMetricRequest(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
	publicdashboardStore := database.ProvideStore(sqlStore)
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})
	publicDashboard := &PublicDashboard{
		Uid:          "1",
		DashboardUid: dashboard.Uid,
		IsEnabled:    true,
		AccessToken:  "abc123",
	}
	service := &PublicDashboardServiceImpl{
		log:                log.New("test.logger"),
		store:              publicdashboardStore,
		intervalCalculator: intervalv2.NewCalculator(),
	}

	t.Run("will return an error when validation fails", func(t *testing.T) {
		publicDashboardQueryDTO := PublicDashboardQueryDTO{
			IntervalMs:    int64(-1),
			MaxDataPoints: int64(-1),
		}

		_, err := service.GetMetricRequest(context.Background(), dashboard, publicDashboard, 1, publicDashboardQueryDTO)

		require.Error(t, err)
	})

	t.Run("will not return an error when validation succeeds", func(t *testing.T) {
		publicDashboardQueryDTO := PublicDashboardQueryDTO{
			IntervalMs:    int64(1),
			MaxDataPoints: int64(1),
		}
		from, to := internal.GetTimeRangeFromDashboard(t, dashboard.Data)

		metricReq, err := service.GetMetricRequest(context.Background(), dashboard, publicDashboard, 1, publicDashboardQueryDTO)

		require.NoError(t, err)
		require.Equal(t, from, metricReq.From)
		require.Equal(t, to, metricReq.To)
	})
}

func TestBuildMetricRequest(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
	publicdashboardStore := database.ProvideStore(sqlStore)

	publicDashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{})
	nonPublicDashboard := insertTestDashboard(t, dashboardStore, "testNonPublicDashie", 1, 0, true, []map[string]interface{}{})
	from, to := internal.GetTimeRangeFromDashboard(t, publicDashboard.Data)

	service := &PublicDashboardServiceImpl{
		log:                log.New("test.logger"),
		store:              publicdashboardStore,
		intervalCalculator: intervalv2.NewCalculator(),
	}

	publicDashboardQueryDTO := PublicDashboardQueryDTO{
		IntervalMs:    int64(10000000),
		MaxDataPoints: int64(200),
	}

	dto := &SavePublicDashboardConfigDTO{
		DashboardUid: publicDashboard.Uid,
		OrgId:        publicDashboard.OrgId,
		PublicDashboard: &PublicDashboard{
			IsEnabled:    true,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: timeSettings,
		},
	}

	publicDashboardPD, err := service.SavePublicDashboardConfig(context.Background(), SignedInUser, dto)
	require.NoError(t, err)

	nonPublicDto := &SavePublicDashboardConfigDTO{
		DashboardUid: nonPublicDashboard.Uid,
		OrgId:        nonPublicDashboard.OrgId,
		PublicDashboard: &PublicDashboard{
			IsEnabled:    false,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: defaultPubdashTimeSettings,
		},
	}

	_, err = service.SavePublicDashboardConfig(context.Background(), SignedInUser, nonPublicDto)
	require.NoError(t, err)

	t.Run("extracts queries from provided dashboard", func(t *testing.T) {
		reqDTO, err := service.buildMetricRequest(
			context.Background(),
			publicDashboard,
			publicDashboardPD,
			1,
			publicDashboardQueryDTO,
		)
		require.NoError(t, err)

		require.Equal(t, from, reqDTO.From)
		require.Equal(t, to, reqDTO.To)

		for i := range reqDTO.Queries {
			require.Equal(t, publicDashboardQueryDTO.IntervalMs, reqDTO.Queries[i].Get("intervalMs").MustInt64())
			require.Equal(t, publicDashboardQueryDTO.MaxDataPoints, reqDTO.Queries[i].Get("maxDataPoints").MustInt64())
		}

		require.Len(t, reqDTO.Queries, 2)

		require.Equal(
			t,
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "mysql",
					"uid":  "ds1",
				},
				"intervalMs":    int64(10000000),
				"maxDataPoints": int64(200),
				"refId":         "A",
			}),
			reqDTO.Queries[0],
		)

		require.Equal(
			t,
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "prometheus",
					"uid":  "ds2",
				},
				"intervalMs":    int64(10000000),
				"maxDataPoints": int64(200),
				"refId":         "B",
			}),
			reqDTO.Queries[1],
		)
	})

	t.Run("returns an error when panel missing", func(t *testing.T) {
		_, err := service.buildMetricRequest(
			context.Background(),
			publicDashboard,
			publicDashboardPD,
			49,
			publicDashboardQueryDTO,
		)

		require.ErrorContains(t, err, "Panel not found")
	})
}

func insertTestDashboard(t *testing.T, dashboardStore *dashboardsDB.DashboardStore, title string, orgId int64,
	folderId int64, isFolder bool, templateVars []map[string]interface{}, tags ...interface{}) *models.Dashboard {
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
					"datasource": map[string]interface{}{
						"uid": "ds1",
					},
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
					"datasource": map[string]interface{}{
						"uid": "ds3",
					},
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
			"templating": map[string]interface{}{
				"list": templateVars,
			},
			"time": map[string]interface{}{
				"from": "2022-09-01T00:00:00.000Z",
				"to":   "2022-09-01T12:00:00.000Z",
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

func TestPublicDashboardServiceImpl_getSafeIntervalAndMaxDataPoints(t *testing.T) {
	type args struct {
		reqDTO PublicDashboardQueryDTO
		ts     TimeSettings
	}
	tests := []struct {
		name                  string
		args                  args
		wantSafeInterval      int64
		wantSafeMaxDataPoints int64
	}{
		{
			name: "return original interval",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    10000,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-3h",
					To:   "now",
				},
			},
			wantSafeInterval:      10000,
			wantSafeMaxDataPoints: 300,
		},
		{
			name: "return safe interval because of a small interval",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    1000,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-6h",
					To:   "now",
				},
			},
			wantSafeInterval:      2000,
			wantSafeMaxDataPoints: 11000,
		},
		{
			name: "return safe interval for long time range",
			args: args{
				reqDTO: PublicDashboardQueryDTO{
					IntervalMs:    100,
					MaxDataPoints: 300,
				},
				ts: TimeSettings{
					From: "now-90d",
					To:   "now",
				},
			},
			wantSafeInterval:      600000,
			wantSafeMaxDataPoints: 11000,
		},
		{
			name: "return safe interval when reqDTO is empty",
			args: args{
				reqDTO: PublicDashboardQueryDTO{},
				ts: TimeSettings{
					From: "now-90d",
					To:   "now",
				},
			},
			wantSafeInterval:      600000,
			wantSafeMaxDataPoints: 11000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pd := &PublicDashboardServiceImpl{
				intervalCalculator: intervalv2.NewCalculator(),
			}
			got, got1 := pd.getSafeIntervalAndMaxDataPoints(tt.args.reqDTO, tt.args.ts)
			assert.Equalf(t, tt.wantSafeInterval, got, "getSafeIntervalAndMaxDataPoints(%v, %v)", tt.args.reqDTO, tt.args.ts)
			assert.Equalf(t, tt.wantSafeMaxDataPoints, got1, "getSafeIntervalAndMaxDataPoints(%v, %v)", tt.args.reqDTO, tt.args.ts)
		})
	}
}

func TestDashboardEnabledChanged(t *testing.T) {
	t.Run("created isEnabled: false", func(t *testing.T) {
		assert.False(t, publicDashboardIsEnabledChanged(nil, &PublicDashboard{IsEnabled: false}))
	})

	t.Run("created isEnabled: true", func(t *testing.T) {
		assert.True(t, publicDashboardIsEnabledChanged(nil, &PublicDashboard{IsEnabled: true}))
	})

	t.Run("updated isEnabled same", func(t *testing.T) {
		assert.False(t, publicDashboardIsEnabledChanged(&PublicDashboard{IsEnabled: true}, &PublicDashboard{IsEnabled: true}))
	})

	t.Run("updated isEnabled changed", func(t *testing.T) {
		assert.True(t, publicDashboardIsEnabledChanged(&PublicDashboard{IsEnabled: false}, &PublicDashboard{IsEnabled: true}))
	})
}
