package service

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	dashboard2 "github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/database"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const (
	dashboardWithNoQueries = `
{
  "panels": [
    {
      "id": 2,
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithTargetsWithNoDatasources = `
{
  "panels": [
    {
      "id": 2,
      "datasource": {
          "type": "postgres",
          "uid": "abc123"
      },
      "targets": [
        {
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithQueriesExemplarEnabled = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithMixedDatasource = `
{
  "panels": [
    {
	  "datasource": {
		"type": "datasource",
		"uid": "-- Mixed --"
	  },
      "id": 1,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "abc123"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 3,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithDuplicateDatasources = `
{
  "panels": [
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "abc123"
	  },
      "id": 1,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "abc123"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 3,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	oldStyleDashboard = `
{
  "panels": [
    {
	  "datasource": "_yxMP8Ynk",
      "id": 2,
      "targets": [
        {
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 21
}`

	dashboardWithOneHiddenQuery = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A",
          "hide": true
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`
	dashboardWithAllHiddenQueries = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A",
          "hide": true
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B",
		  "hide": true
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithRows = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
      "id": 3,
      "collapsed": true,
      "gridPos": {
        "h": 1,
        "w": 24,
        "x": 0,
        "y": 9
      },
      "title": "This panel is a Row",
      "type": "row",
"panels": [
    {
      "id": 4,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel inside a row",
      "type": "timeseries"
    }
  ]
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithCollapsedRows = `
{
"panels": [
    {
      "gridPos": {
        "h": 1,
        "w": 24,
        "x": 0,
        "y": 0
      },
      "id": 12,
      "title": "Row title",
      "type": "row"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "qCbTUC37k"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "axisCenteredZero": false,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": 0,
            "gradientMode": "none",
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            },
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 5,
            "scaleDistribution": {
              "type": "linear"
            },
            "showPoints": "auto",
            "spanNulls": false,
            "stacking": {
              "group": "A",
              "mode": "none"
            },
            "thresholdsStyle": {
              "mode": "off"
            }
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 1
      },
      "id": 11,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "qCbTUC37k"
          },
          "editorMode": "builder",
          "expr": "access_evaluation_duration_bucket",
          "legendFormat": "__auto",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
      "collapsed": true,
      "gridPos": {
        "h": 1,
        "w": 24,
        "x": 0,
        "y": 9
      },
      "id": 10,
      "panels": [
        {
          "datasource": {
            "type": "influxdb",
            "uid": "P49A45DF074423DFB"
          },
          "fieldConfig": {
            "defaults": {
              "color": {
                "mode": "palette-classic"
              },
              "custom": {
                "axisCenteredZero": false,
                "axisColorMode": "text",
                "axisLabel": "",
                "axisPlacement": "auto",
                "barAlignment": 0,
                "drawStyle": "line",
                "fillOpacity": 0,
                "gradientMode": "none",
                "hideFrom": {
                  "legend": false,
                  "tooltip": false,
                  "viz": false
                },
                "lineInterpolation": "linear",
                "lineWidth": 1,
                "pointSize": 5,
                "scaleDistribution": {
                  "type": "linear"
                },
                "showPoints": "auto",
                "spanNulls": false,
                "stacking": {
                  "group": "A",
                  "mode": "none"
                },
                "thresholdsStyle": {
                  "mode": "off"
                }
              },
              "mappings": [],
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  {
                    "color": "green"
                  },
                  {
                    "color": "red",
                    "value": 80
                  }
                ]
              }
            },
            "overrides": []
          },
          "gridPos": {
            "h": 9,
            "w": 12,
            "x": 0,
            "y": 10
          },
          "id": 8,
          "options": {
            "legend": {
              "calcs": [],
              "displayMode": "list",
              "placement": "bottom",
              "showLegend": true
            },
            "tooltip": {
              "mode": "single",
              "sort": "none"
            }
          },
          "pluginVersion": "9.4.0-pre",
          "targets": [
            {
              "datasource": {
                "type": "influxdb",
                "uid": "P49A45DF074423DFB"
              },
              "query": "// v.bucket, v.timeRangeStart, and v.timeRange stop are all variables supported by the flux plugin and influxdb\nfrom(bucket: v.bucket)\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n  |> filter(fn: (r) => r[\"_value\"] >= 10 and r[\"_value\"] <= 20)",
              "refId": "A"
            }
          ],
          "title": "Panel Title",
          "type": "timeseries"
        }
      ],
      "title": "Row title 1",
      "type": "row"
    }
  ]
}`
)

func TestGetQueryDataResponse(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
	require.NoError(t, err)
	publicdashboardStore := database.ProvideStore(sqlStore)
	serviceWrapper := ProvideServiceWrapper(publicdashboardStore)
	fakeQueryService := &query.FakeQueryService{}
	fakeQueryService.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&backend.QueryDataResponse{}, nil)

	service := &PublicDashboardServiceImpl{
		log:                log.New("test.logger"),
		store:              publicdashboardStore,
		intervalCalculator: intervalv2.NewCalculator(),
		QueryDataService:   fakeQueryService,
		serviceWrapper:     serviceWrapper,
	}

	publicDashboardQueryDTO := PublicDashboardQueryDTO{
		IntervalMs:    int64(1),
		MaxDataPoints: int64(1),
	}

	t.Run("Returns query data even when the query is hidden", func(t *testing.T) {
		hiddenQuery := map[string]interface{}{
			"datasource": map[string]interface{}{
				"type": "mysql",
				"uid":  "ds1",
			},
			"hide":  true,
			"refId": "A",
		}
		customPanels := []interface{}{
			map[string]interface{}{
				"id": 1,
				"datasource": map[string]interface{}{
					"uid": "ds1",
				},
				"targets": []interface{}{hiddenQuery},
			}}

		dashboard := insertTestDashboard(t, dashboardStore, "testDashWithHiddenQuery", 1, 0, true, []map[string]interface{}{}, customPanels)
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgId:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "NOTTHESAME",
				OrgId:        9999999,
				TimeSettings: timeSettings,
			},
		}
		pubdashDto, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		resp, _ := service.GetQueryDataResponse(context.Background(), true, publicDashboardQueryDTO, 1, pubdashDto.AccessToken)
		require.NotNil(t, resp)
	})
}

func TestFindAnnotations(t *testing.T) {
	color := "red"
	name := "annoName"
	t.Run("will build anonymous user with correct permissions to get annotations", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		config := setting.NewCfg()
		tagService := tagimpl.ProvideService(sqlStore, sqlStore.Cfg)
		annotationsRepo := annotationsimpl.ProvideService(sqlStore, config, featuremgmt.WithFeatures(), tagService)
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: annotationsRepo,
		}
		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).
			Return(&PublicDashboard{Uid: "uid1", IsEnabled: true}, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).
			Return(dashboards.NewDashboard("dash1"), nil)

		reqDTO := AnnotationsQueryDTO{
			From: 1,
			To:   2,
		}
		dash := dashboards.NewDashboard("testDashboard")

		items, _ := service.FindAnnotations(context.Background(), reqDTO, "abc123")
		anonUser := buildAnonymousUser(context.Background(), dash)

		assert.Equal(t, "dashboards:*", anonUser.Permissions[0]["dashboards:read"][0])
		assert.Len(t, items, 0)
	})

	t.Run("Test events from tag queries overwrite built-in annotation queries and duplicate events are not returned", func(t *testing.T) {
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: false,
				Tags:     nil,
				Type:     "dashboard",
			},
			Type: util.Pointer("dashboard"),
		}
		grafanaTagAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: false,
				Tags:     []string{"tag1"},
				Type:     "tags",
			},
		}
		annos := []DashAnnotation{grafanaAnnotation, grafanaTagAnnotation}
		dashboard := AddAnnotationsToDashboard(t, dash, annos)

		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		annotationsRepo.On("Find", mock.Anything, mock.Anything).Return([]*annotations.ItemDTO{
			{
				ID:          1,
				DashboardID: 1,
				PanelID:     1,
				Tags:        []string{"tag1"},
				TimeEnd:     2,
				Time:        2,
				Text:        "text",
			},
		}, nil).Maybe()

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		expected := AnnotationEvent{
			Id:          1,
			DashboardId: 1,
			PanelId:     0,
			Tags:        []string{"tag1"},
			IsRegion:    false,
			Text:        "text",
			Color:       color,
			Time:        2,
			TimeEnd:     2,
			Source:      grafanaTagAnnotation,
		}
		require.NoError(t, err)
		assert.Len(t, items, 1)
		assert.Equal(t, expected, items[0])
	})

	t.Run("Test panelId set to zero when annotation event is for a tags query", func(t *testing.T) {
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: false,
				Tags:     []string{"tag1"},
				Type:     "tags",
			},
		}
		annos := []DashAnnotation{grafanaAnnotation}
		dashboard := AddAnnotationsToDashboard(t, dash, annos)

		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		annotationsRepo.On("Find", mock.Anything, mock.Anything).Return([]*annotations.ItemDTO{
			{
				ID:          1,
				DashboardID: 1,
				PanelID:     1,
				Tags:        []string{},
				TimeEnd:     1,
				Time:        2,
				Text:        "text",
			},
		}, nil).Maybe()

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		expected := AnnotationEvent{
			Id:          1,
			DashboardId: 1,
			PanelId:     0,
			Tags:        []string{},
			IsRegion:    true,
			Text:        "text",
			Color:       color,
			Time:        2,
			TimeEnd:     1,
			Source:      grafanaAnnotation,
		}
		require.NoError(t, err)
		assert.Len(t, items, 1)
		assert.Equal(t, expected, items[0])
	})

	t.Run("Test can get grafana annotations and will skip annotation queries and disabled annotations", func(t *testing.T) {
		dash := dashboards.NewDashboard("test")
		disabledGrafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     false,
			Name:       name,
			IconColor:  color,
		}
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: true,
				Tags:     nil,
				Type:     "dashboard",
			},
			Type: util.Pointer("dashboard"),
		}
		queryAnnotation := DashAnnotation{
			Datasource: CreateDatasource("prometheus", "abc123"),
			Enable:     true,
			Name:       name,
		}
		annos := []DashAnnotation{grafanaAnnotation, queryAnnotation, disabledGrafanaAnnotation}
		dashboard := AddAnnotationsToDashboard(t, dash, annos)

		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		annotationsRepo.On("Find", mock.Anything, mock.Anything).Return([]*annotations.ItemDTO{
			{
				ID:          1,
				DashboardID: 1,
				PanelID:     1,
				Tags:        []string{},
				TimeEnd:     1,
				Time:        2,
				Text:        "text",
			},
		}, nil).Maybe()

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		expected := AnnotationEvent{
			Id:          1,
			DashboardId: 1,
			PanelId:     1,
			Tags:        []string{},
			IsRegion:    true,
			Text:        "text",
			Color:       color,
			Time:        2,
			TimeEnd:     1,
			Source:      grafanaAnnotation,
		}
		require.NoError(t, err)
		assert.Len(t, items, 1)
		assert.Equal(t, expected, items[0])
	})

	t.Run("test will return nothing when dashboard has no annotations", func(t *testing.T) {
		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		dashboard := dashboards.NewDashboard("dashWithNoAnnotations")
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		require.NoError(t, err)
		assert.Empty(t, items)
	})

	t.Run("test will return nothing when pubdash annotations are disabled", func(t *testing.T) {
		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: false,
				Tags:     nil,
				Type:     "dashboard",
			},
			Type: util.Pointer("dashboard"),
		}
		annos := []DashAnnotation{grafanaAnnotation}
		dashboard := AddAnnotationsToDashboard(t, dash, annos)
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: false}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		require.NoError(t, err)
		assert.Empty(t, items)
	})

	t.Run("test will error when annotations repo returns an error", func(t *testing.T) {
		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Target: &dashboard2.AnnotationTarget{
				Limit:    100,
				MatchAny: false,
				Tags:     []string{"tag1"},
				Type:     "tags",
			},
		}
		annos := []DashAnnotation{grafanaAnnotation}
		dash = AddAnnotationsToDashboard(t, dash, annos)
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dash.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dash, nil)

		annotationsRepo.On("Find", mock.Anything, mock.Anything).Return(nil, errors.New("failed")).Maybe()

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		require.Error(t, err)
		require.Nil(t, items)
	})

	t.Run("Test find annotations does not panics when Target in datasource is nil", func(t *testing.T) {
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       name,
			IconColor:  color,
			Type:       util.Pointer("dashboard"),
			Target:     nil,
		}

		annos := []DashAnnotation{grafanaAnnotation}
		dashboard := AddAnnotationsToDashboard(t, dash, annos)

		annotationsRepo := annotations.FakeAnnotationsRepo{}
		fakeStore := FakePublicDashboardStore{}
		service := &PublicDashboardServiceImpl{
			log:             log.New("test.logger"),
			store:           &fakeStore,
			AnnotationsRepo: &annotationsRepo,
		}
		pubdash := &PublicDashboard{Uid: "uid1", IsEnabled: true, OrgId: 1, DashboardUid: dashboard.UID, AnnotationsEnabled: true}

		fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
		fakeStore.On("FindDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("string")).Return(dashboard, nil)

		annotationsRepo.On("Find", mock.Anything, mock.Anything).Return([]*annotations.ItemDTO{
			{
				ID:          1,
				DashboardID: 1,
				PanelID:     1,
				Tags:        []string{"tag1"},
				TimeEnd:     2,
				Time:        2,
				Text:        "this is an annotation",
			},
		}, nil).Maybe()

		items, err := service.FindAnnotations(context.Background(), AnnotationsQueryDTO{}, "abc123")

		expected := AnnotationEvent{
			Id:          1,
			DashboardId: 1,
			PanelId:     1,
			Tags:        []string{"tag1"},
			IsRegion:    false,
			Text:        "this is an annotation",
			Color:       color,
			Time:        2,
			TimeEnd:     2,
			Source:      grafanaAnnotation,
		}
		require.NoError(t, err)
		assert.Len(t, items, 1)
		assert.Equal(t, expected, items[0])
	})
}

func TestGetMetricRequest(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
	require.NoError(t, err)
	publicdashboardStore := database.ProvideStore(sqlStore)
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)
	publicDashboard := &PublicDashboard{
		Uid:          "1",
		DashboardUid: dashboard.UID,
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

func TestGetUniqueDashboardDatasourceUids(t *testing.T) {
	t.Run("can get unique datasource ids from dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithDuplicateDatasources))
		require.NoError(t, err)

		uids := getUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 2)
		require.Equal(t, "abc123", uids[0])
		require.Equal(t, "_yxMP8Ynk", uids[1])
	})

	t.Run("can get unique datasource ids from dashboard with a mixed datasource", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithMixedDatasource))
		require.NoError(t, err)

		uids := getUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 2)
		require.Equal(t, "abc123", uids[0])
		require.Equal(t, "_yxMP8Ynk", uids[1])
	})

	t.Run("can get no datasource uids from empty dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(`{"panels": {}}`))
		require.NoError(t, err)

		uids := getUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 0)
	})

	t.Run("can get unique datasource ids from dashboard with rows", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithCollapsedRows))
		require.NoError(t, err)

		uids := getUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 2)
		require.Equal(t, "qCbTUC37k", uids[0])
		require.Equal(t, "P49A45DF074423DFB", uids[1])
	})
}

func TestBuildMetricRequest(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
	require.NoError(t, err)
	publicdashboardStore := database.ProvideStore(sqlStore)
	serviceWrapper := ProvideServiceWrapper(publicdashboardStore)
	publicDashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)
	nonPublicDashboard := insertTestDashboard(t, dashboardStore, "testNonPublicDashie", 1, 0, true, []map[string]interface{}{}, nil)
	from, to := internal.GetTimeRangeFromDashboard(t, publicDashboard.Data)

	service := &PublicDashboardServiceImpl{
		log:                log.New("test.logger"),
		store:              publicdashboardStore,
		intervalCalculator: intervalv2.NewCalculator(),
		serviceWrapper:     serviceWrapper,
	}

	publicDashboardQueryDTO := PublicDashboardQueryDTO{
		IntervalMs:    int64(10000000),
		MaxDataPoints: int64(200),
	}

	dto := &SavePublicDashboardDTO{
		DashboardUid: publicDashboard.UID,
		OrgId:        publicDashboard.OrgID,
		PublicDashboard: &PublicDashboard{
			IsEnabled:    true,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: timeSettings,
		},
	}

	publicDashboardPD, err := service.Create(context.Background(), SignedInUser, dto)
	require.NoError(t, err)

	nonPublicDto := &SavePublicDashboardDTO{
		DashboardUid: nonPublicDashboard.UID,
		OrgId:        nonPublicDashboard.OrgID,
		PublicDashboard: &PublicDashboard{
			IsEnabled:    false,
			DashboardUid: "NOTTHESAME",
			OrgId:        9999999,
			TimeSettings: defaultPubdashTimeSettings,
		},
	}

	_, err = service.Create(context.Background(), SignedInUser, nonPublicDto)
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
				"intervalMs":      int64(10000000),
				"maxDataPoints":   int64(200),
				"queryCachingTTL": int64(0),
				"refId":           "A",
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
				"intervalMs":      int64(10000000),
				"maxDataPoints":   int64(200),
				"queryCachingTTL": int64(0),
				"refId":           "B",
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

		require.ErrorContains(t, err, ErrPanelNotFound.Error())
	})

	t.Run("metric request built with hidden query", func(t *testing.T) {
		hiddenQuery := map[string]interface{}{
			"datasource": map[string]interface{}{
				"type": "mysql",
				"uid":  "ds1",
			},
			"hide":  true,
			"refId": "A",
		}
		nonHiddenQuery := map[string]interface{}{
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "ds2",
			},
			"refId": "B",
		}

		customPanels := []interface{}{
			map[string]interface{}{
				"id": 1,
				"datasource": map[string]interface{}{
					"uid": "ds1",
				},
				"targets": []interface{}{hiddenQuery, nonHiddenQuery},
			}}

		publicDashboard := insertTestDashboard(t, dashboardStore, "testDashWithHiddenQuery", 1, 0, true, []map[string]interface{}{}, customPanels)

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
			simplejson.NewFromAny(hiddenQuery),
			reqDTO.Queries[0],
		)

		require.Equal(
			t,
			simplejson.NewFromAny(nonHiddenQuery),
			reqDTO.Queries[1],
		)
	})
}

func TestBuildAnonymousUser(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, sqlStore.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
	require.NoError(t, err)
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true, []map[string]interface{}{}, nil)

	t.Run("will add datasource read and query permissions to user for each datasource in dashboard", func(t *testing.T) {
		user := buildAnonymousUser(context.Background(), dashboard)

		require.Equal(t, dashboard.OrgID, user.OrgID)
		require.Equal(t, "datasources:uid:ds1", user.Permissions[user.OrgID]["datasources:query"][0])
		require.Equal(t, "datasources:uid:ds3", user.Permissions[user.OrgID]["datasources:query"][1])
		require.Equal(t, "datasources:uid:ds1", user.Permissions[user.OrgID]["datasources:read"][0])
		require.Equal(t, "datasources:uid:ds3", user.Permissions[user.OrgID]["datasources:read"][1])
	})
	t.Run("will add dashboard and annotation permissions needed for getting annotations", func(t *testing.T) {
		user := buildAnonymousUser(context.Background(), dashboard)

		require.Equal(t, dashboard.OrgID, user.OrgID)
		require.Equal(t, "annotations:type:dashboard", user.Permissions[user.OrgID]["annotations:read"][0])
		require.Equal(t, "dashboards:*", user.Permissions[user.OrgID]["dashboards:read"][0])
	})
}

func TestGroupQueriesByPanelId(t *testing.T) {
	t.Run("can extract queries from dashboard with panel datasource string that has no datasource on panel targets", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(oldStyleDashboard))
		require.NoError(t, err)
		queries := groupQueriesByPanelId(json)

		panelId := int64(2)
		queriesByDatasource := groupQueriesByDataSource(t, queries[panelId])
		require.Len(t, queriesByDatasource[0], 1)
	})
	t.Run("will delete exemplar property from target if exists", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithQueriesExemplarEnabled))
		require.NoError(t, err)
		queries := groupQueriesByPanelId(json)

		panelId := int64(2)
		queriesByDatasource := groupQueriesByDataSource(t, queries[panelId])
		for _, query := range queriesByDatasource[0] {
			_, ok := query.CheckGet("exemplar")
			require.False(t, ok)
		}
	})
	t.Run("can extract queries from dashboard with panel json datasource that has no datasource on panel targets", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithTargetsWithNoDatasources))
		require.NoError(t, err)
		queries := groupQueriesByPanelId(json)

		panelId := int64(2)
		queriesByDatasource := groupQueriesByDataSource(t, queries[panelId])
		require.Len(t, queriesByDatasource[0], 2)
	})
	t.Run("can extract no queries from empty dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(`{"panels": {}}`))
		require.NoError(t, err)

		queries := groupQueriesByPanelId(json)
		require.Len(t, queries, 0)
	})

	t.Run("can extract no queries from empty panel", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithNoQueries))
		require.NoError(t, err)

		queries := groupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 0)
	})

	t.Run("can extract queries from panels", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithQueriesExemplarEnabled))
		require.NoError(t, err)

		queries := groupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 2)
		query, err := queries[2][0].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
              "type": "prometheus",
              "uid": "_yxMP8Ynk"
            },
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`, string(query))
		query, err = queries[2][1].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
              "type": "prometheus",
              "uid": "promds2"
            },
            "expr": "query2",
            "interval": "",
            "legendFormat": "",
            "refId": "B"
		}`, string(query))
	})

	t.Run("can extract queries from old-style panels", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(oldStyleDashboard))
		require.NoError(t, err)

		queries := groupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 1)
		query, err := queries[2][0].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
				"uid": "_yxMP8Ynk",
				"type": "public-ds"
			},
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`, string(query))
	})

	t.Run("hidden query not filtered", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithOneHiddenQuery))
		require.NoError(t, err)
		queries := groupQueriesByPanelId(json)[2]

		require.Len(t, queries, 2)
	})

	t.Run("hidden queries not filtered, so queries returned", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithAllHiddenQueries))
		require.NoError(t, err)
		queries := groupQueriesByPanelId(json)[2]

		require.Len(t, queries, 2)
	})

	t.Run("queries inside panels inside rows are returned", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithRows))
		require.NoError(t, err)

		queries := groupQueriesByPanelId(json)
		for idx := range queries {
			assert.NotNil(t, queries[idx])
		}

		assert.Len(t, queries, 2)
	})
}

func TestGroupQueriesByDataSource(t *testing.T) {
	t.Run("can divide queries by datasource", func(t *testing.T) {
		queries := []*simplejson.Json{
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "prometheus",
					"uid": "_yxMP8Ynk"
				},
				"exemplar": true,
				"expr": "go_goroutines{job=\"$job\"}",
				"interval": "",
				"legendFormat": "",
				"refId": "A"
			}`)),
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "prometheus",
					"uid": "promds2"
				},
				"exemplar": true,
				"expr": "query2",
				"interval": "",
				"legendFormat": "",
				"refId": "B"
			}`)),
		}

		queriesByDatasource := groupQueriesByDataSource(t, queries)
		require.Len(t, queriesByDatasource, 2)
		require.Contains(t, queriesByDatasource, []*simplejson.Json{simplejson.MustJson([]byte(`{
            "datasource": {
              "type": "prometheus",
              "uid": "_yxMP8Ynk"
            },
            "exemplar": true,
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`))})
		require.Contains(t, queriesByDatasource, []*simplejson.Json{simplejson.MustJson([]byte(`{
            "datasource": {
              "type": "prometheus",
              "uid": "promds2"
            },
            "exemplar": true,
            "expr": "query2",
            "interval": "",
            "legendFormat": "",
            "refId": "B"
		}`))})
	})
}

func TestSanitizeMetadataFromQueryData(t *testing.T) {
	t.Run("can remove metadata from query", func(t *testing.T) {
		fakeResponse := &backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": backend.DataResponse{
					Frames: data.Frames{
						&data.Frame{
							Name: "1",
							Meta: &data.FrameMeta{
								ExecutedQueryString: "Test1",
								Custom: map[string]string{
									"test1": "test1",
								},
							},
						},
						&data.Frame{
							Name: "2",
							Meta: &data.FrameMeta{
								ExecutedQueryString: "Test2",
								Custom: map[string]string{
									"test2": "test2",
								},
							},
						},
					},
				},
				"B": backend.DataResponse{
					Frames: data.Frames{
						&data.Frame{
							Name: "3",
							Meta: &data.FrameMeta{
								ExecutedQueryString: "Test3",
								Custom: map[string]string{
									"test3": "test3",
								},
							},
						},
					},
				},
			},
		}
		sanitizeMetadataFromQueryData(fakeResponse)
		for k := range fakeResponse.Responses {
			frames := fakeResponse.Responses[k].Frames
			for i := range frames {
				require.Empty(t, frames[i].Meta.ExecutedQueryString)
				require.Empty(t, frames[i].Meta.Custom)
			}
		}
	})
}

func groupQueriesByDataSource(t *testing.T, queries []*simplejson.Json) (result [][]*simplejson.Json) {
	t.Helper()
	byDataSource := make(map[string][]*simplejson.Json)

	for _, query := range queries {
		uid := getDataSourceUidFromJson(query)
		byDataSource[uid] = append(byDataSource[uid], query)
	}

	for _, queries := range byDataSource {
		result = append(result, queries)
	}

	return
}
