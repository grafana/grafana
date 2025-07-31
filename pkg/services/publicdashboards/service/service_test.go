package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service/intervalv2"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

var (
	timeSettings               = &TimeSettings{From: "now-12h", To: "now"}
	defaultPubdashTimeSettings = &TimeSettings{}
	dashboardData              = simplejson.NewFromAny(map[string]any{"time": map[string]any{"from": "now-8h", "to": "now"}})
	SignedInUser               = &user.SignedInUser{UserID: 1234, Login: "user@login.com"}
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.service")
}

func TestIntegrationGetPublicDashboardForView(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type storeResp struct {
		pd  *PublicDashboard
		d   *dashboards.Dashboard
		err error
	}

	const dashboardWithRowsAndHiddenQueries = `
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
    },
    {
      "aliasColors": {
        "total avg": "#6ed0e0"
      },
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": {
        "type": "mssql",
        "uid": "P6B08AC199690F328"
      },
      "fieldConfig": {
        "defaults": {
          "links": []
        },
        "overrides": []
      },
      "fill": 2,
      "fillGradient": 0,
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 4,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 2,
      "links": [],
      "nullPointMode": "null",
      "options": {
        "alertThreshold": true
      },
      "percentage": false,
      "pluginVersion": "10.2.0-pre",
      "pointradius": 5,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [
        {
          "alias": "total avg",
          "fill": 0,
          "pointradius": 3,
          "points": true
        }
      ],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "alias": "",
          "datasource": {
            "type": "mssql",
            "uid": "P6B08AC199690F328"
          },
          "format": "time_series",
          "rawSql": "SELECT\n  $__timeGroup(createdAt,'$summarize') as time,\n  avg(value) as value,\n  hostname as metric\nFROM \n  grafana_metric\nWHERE\n  $__timeFilter(createdAt) AND\n  measurement = 'logins.count' AND\n  hostname IN($host)\nGROUP BY $__timeGroup(createdAt,'$summarize'), hostname\nORDER BY 1",
          "refId": "A"
        },
        {
          "alias": "",
          "datasource": {
            "type": "mssql",
            "uid": "P6B08AC199690F328"
          },
          "format": "time_series",
          "rawSql": "SELECT\n  $__timeGroup(createdAt,'$summarize') as time,\n  min(value) as value,\n  'total avg' as metric\nFROM \n  grafana_metric\nWHERE\n  $__timeFilter(createdAt) AND\n  measurement = 'logins.count'\nGROUP BY $__timeGroup(createdAt,'$summarize')\nORDER BY 1",
          "refId": "B"
        }
      ],
      "thresholds": [],
      "timeRegions": [],
      "title": "Average logins / $summarize",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "mode": "time",
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "logBase": 1,
          "show": true
        },
        {
          "format": "short",
          "logBase": 1,
          "show": true
        }
      ],
      "yaxis": {
        "align": false
      }
    },
    {
      "datasource": {
        "type": "influxdb",
        "uid": "P49A45DF074423DFB"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
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
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 5,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "/^retentionPeriod 4a2f27036bf63a3c$/",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "10.2.0-pre",
      "targets": [
        {
          "datasource": {
            "type": "influxdb",
            "uid": "P49A45DF074423DFB"
          },
          "query": "buckets()",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "stat"
    }
  ],
  "schemaVersion": 35,
  "timepicker": {
    "hidden": false
  }
}`
	data, _ := simplejson.NewJson([]byte(dashboardWithRowsAndHiddenQueries))

	now := time.Now()

	// #nosec G101 -- This is dummy/test token
	accessToken := "c54b1c4dd2b143a1a7a43005264d256d"
	d := &dashboards.Dashboard{UID: "mydashboard", OrgID: 0, Data: data, Slug: "dashboardSlug", Created: now, Updated: now, Version: 1, FolderUID: "myFolder"}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *dtos.DashboardFullWithMeta
	}{
		{
			Name:        "returns a dashboard with the time picker shown",
			AccessToken: accessToken,
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: accessToken, IsEnabled: true, TimeSelectionEnabled: true},
				d:   d,
				err: nil,
			},
			ErrResp: nil,
			DashResp: &dtos.DashboardFullWithMeta{
				Dashboard: data,
				Meta: dtos.DashboardMeta{
					Slug:                   d.Slug,
					Type:                   dashboards.DashTypeDB,
					CanStar:                false,
					CanSave:                false,
					CanEdit:                false,
					CanAdmin:               false,
					CanDelete:              false,
					Created:                d.Created,
					Updated:                d.Updated,
					Version:                d.Version,
					IsFolder:               false,
					FolderUid:              d.FolderUID,
					PublicDashboardEnabled: true,
				},
			},
		},
		{
			Name:        "returns a dashboard with the time picker hidden",
			AccessToken: accessToken,
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: accessToken, IsEnabled: true, TimeSelectionEnabled: false},
				d:   d,
				err: nil,
			},
			ErrResp: nil,
			DashResp: &dtos.DashboardFullWithMeta{
				Dashboard: data,
				Meta: dtos.DashboardMeta{
					Slug:                   d.Slug,
					Type:                   dashboards.DashTypeDB,
					CanStar:                false,
					CanSave:                false,
					CanEdit:                false,
					CanAdmin:               false,
					CanDelete:              false,
					Created:                d.Created,
					Updated:                d.Updated,
					Version:                d.Version,
					IsFolder:               false,
					FolderUid:              d.FolderUID,
					PublicDashboardEnabled: true,
				},
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(test.StoreResp.pd, test.StoreResp.err)
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(test.StoreResp.d, test.StoreResp.err)
			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, nil)

			dashboardFullWithMeta, err := service.GetPublicDashboardForView(context.Background(), test.AccessToken)
			if test.ErrResp != nil {
				assert.Error(t, test.ErrResp, err)
			} else {
				require.NoError(t, err)
			}

			// assert.Equal(t, test.DashResp, dash)

			if test.DashResp != nil {
				assert.Equal(t, test.DashResp.Meta.Slug, dashboardFullWithMeta.Meta.Slug)
				assert.Equal(t, test.DashResp.Meta.Type, dashboardFullWithMeta.Meta.Type)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.CanStar)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.CanSave)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.CanEdit)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.CanAdmin)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.CanDelete)
				assert.Equal(t, test.DashResp.Meta.Created, dashboardFullWithMeta.Meta.Created)
				assert.Equal(t, test.DashResp.Meta.Updated, dashboardFullWithMeta.Meta.Updated)
				assert.Equal(t, test.DashResp.Meta.Version, dashboardFullWithMeta.Meta.Version)
				assert.Equal(t, false, dashboardFullWithMeta.Meta.IsFolder)
				assert.Equal(t, test.DashResp.Meta.FolderUid, dashboardFullWithMeta.Meta.FolderUid)
				assert.Equal(t, test.DashResp.Meta.PublicDashboardEnabled, dashboardFullWithMeta.Meta.PublicDashboardEnabled)

				// hide the timepicker if the time selection is disabled
				assert.Equal(t, test.StoreResp.pd.TimeSelectionEnabled, !dashboardFullWithMeta.Dashboard.Get("timepicker").Get("hidden").MustBool())

				for _, panelObj := range dashboardFullWithMeta.Dashboard.Get("panels").MustArray() {
					panel := simplejson.NewFromAny(panelObj)

					// if the panel is a row and it is collapsed, get the queries from the panels inside the row
					if panel.Get("type").MustString() == "row" && panel.Get("collapsed").MustBool() {
						// recursive call to get queries from panels inside a row
						sanitizeData(panel)
						continue
					}

					for _, targetObj := range panel.Get("targets").MustArray() {
						target := simplejson.NewFromAny(targetObj)
						assert.Empty(t, target.Get("expr").MustString())
						assert.Empty(t, target.Get("query").MustString())
						assert.Empty(t, target.Get("rawSql").MustString())
					}
				}
			}
		})
	}
}

func TestIntegrationGetPublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type storeResp struct {
		pd  *PublicDashboard
		d   *dashboards.Dashboard
		err error
	}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *dashboards.Dashboard
	}{
		{
			Name:        "returns a dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: true},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns dashboard when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: false},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
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
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(test.StoreResp.d, test.StoreResp.err)
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(test.StoreResp.pd, test.StoreResp.err)
			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, nil)

			pdc, dash, err := service.FindPublicDashboardAndDashboardByAccessToken(context.Background(), test.AccessToken)
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

func TestIntegrationGetEnabledPublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type storeResp struct {
		pd  *PublicDashboard
		d   *dashboards.Dashboard
		err error
	}

	testCases := []struct {
		Name        string
		AccessToken string
		StoreResp   *storeResp
		ErrResp     error
		DashResp    *dashboards.Dashboard
	}{
		{
			Name:        "returns a dashboard",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: true},
				d:   &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
				err: nil,
			},
			ErrResp:  nil,
			DashResp: &dashboards.Dashboard{UID: "mydashboard", Data: dashboardData},
		},
		{
			Name:        "returns ErrPublicDashboardNotFound when isEnabled is false",
			AccessToken: "abc123",
			StoreResp: &storeResp{
				pd:  &PublicDashboard{AccessToken: "abcdToken", IsEnabled: false},
				d:   &dashboards.Dashboard{UID: "mydashboard"},
				err: nil,
			},
			ErrResp:  ErrPublicDashboardNotFound,
			DashResp: nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(test.StoreResp.pd, test.StoreResp.err)
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(test.StoreResp.d, test.StoreResp.err)
			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, nil)

			pdc, dash, err := service.FindEnabledPublicDashboardAndDashboardByAccessToken(context.Background(), test.AccessToken)
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

// We're using sqlite here because testing all of the behaviors with mocks in
// the correct order is convoluted.
func TestIntegrationCreatePublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("Create public dashboard", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, settingsProvider := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)

		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled, annotationsEnabled, timeSelectionEnabled := true, false, true

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			OrgID:        dashboard.OrgID,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled:            &isEnabled,
				AnnotationsEnabled:   &annotationsEnabled,
				TimeSelectionEnabled: &timeSelectionEnabled,
				Share:                EmailShareType,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		// DashboardUid/OrgId/CreatedBy set by the command, not parameters
		assert.Equal(t, dashboard.UID, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgID, pubdash.OrgId)
		assert.Equal(t, dto.UserId, pubdash.CreatedBy)
		assert.Equal(t, *dto.PublicDashboard.AnnotationsEnabled, pubdash.AnnotationsEnabled)
		assert.Equal(t, *dto.PublicDashboard.TimeSelectionEnabled, pubdash.TimeSelectionEnabled)
		// ExistsEnabledByDashboardUid set by parameters
		assert.Equal(t, *dto.PublicDashboard.IsEnabled, pubdash.IsEnabled)
		// CreatedAt set to non-zero time
		assert.NotEqual(t, &time.Time{}, pubdash.CreatedAt)
		assert.Equal(t, dto.PublicDashboard.Share, pubdash.Share)
		// accessToken is valid uuid
		_, err = uuid.Parse(pubdash.AccessToken)
		require.NoError(t, err, "expected a valid UUID, got %s", pubdash.AccessToken)
	})

	trueBooleanField := true

	testCases := []struct {
		Name                 string
		IsEnabled            *bool
		TimeSelectionEnabled *bool
		AnnotationsEnabled   *bool
	}{
		{
			Name:                 "isEnabled",
			IsEnabled:            nil,
			TimeSelectionEnabled: &trueBooleanField,
			AnnotationsEnabled:   &trueBooleanField,
		},
		{
			Name:                 "timeSelectionEnabled",
			IsEnabled:            &trueBooleanField,
			TimeSelectionEnabled: nil,
			AnnotationsEnabled:   &trueBooleanField,
		},
		{
			Name:                 "annotationsEnabled",
			IsEnabled:            &trueBooleanField,
			TimeSelectionEnabled: &trueBooleanField,
			AnnotationsEnabled:   nil,
		},
		{
			Name:                 "isEnabled, timeSelectionEnabled and annotationsEnabled",
			IsEnabled:            nil,
			TimeSelectionEnabled: nil,
			AnnotationsEnabled:   nil,
		},
	}

	for _, tt := range testCases {
		t.Run(fmt.Sprintf("Create public dashboard with %s null boolean fields stores them as false", tt.Name), func(t *testing.T) {
			fakeDashboardService := &dashboards.FakeDashboardService{}
			service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)
			dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
			require.NoError(t, err)
			dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

			dto := &SavePublicDashboardDTO{
				DashboardUid: dashboard.UID,
				UserId:       7,
				OrgID:        dashboard.OrgID,
				PublicDashboard: &PublicDashboardDTO{
					IsEnabled:            tt.IsEnabled,
					TimeSelectionEnabled: tt.TimeSelectionEnabled,
					AnnotationsEnabled:   tt.AnnotationsEnabled,
					Share:                PublicShareType,
				},
			}

			_, err = service.Create(context.Background(), SignedInUser, dto)
			require.NoError(t, err)
			pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
			require.NoError(t, err)

			assertFalseIfNull(t, pubdash.IsEnabled, dto.PublicDashboard.IsEnabled)
			assertFalseIfNull(t, pubdash.TimeSelectionEnabled, dto.PublicDashboard.TimeSelectionEnabled)
			assertFalseIfNull(t, pubdash.AnnotationsEnabled, dto.PublicDashboard.AnnotationsEnabled)
		})
	}

	t.Run("Validate pubdash has default time setting value", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled := true
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgID:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)
		assert.Equal(t, defaultPubdashTimeSettings, pubdash.TimeSettings)
	})

	t.Run("Creates pubdash whose dashboard has template variables successfully", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)

		templateVars := make([]map[string]any, 1)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, templateVars, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled := true
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgID:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		assert.Equal(t, dashboard.UID, pubdash.DashboardUid)
		assert.Equal(t, dashboard.OrgID, pubdash.OrgId)
	})

	t.Run("Throws an error when given pubdash uid already exists", func(t *testing.T) {
		dashboard := dashboards.NewDashboard("testDashie")
		pubdash := &PublicDashboard{
			Uid:                "ExistingUid",
			IsEnabled:          true,
			AnnotationsEnabled: false,
			DashboardUid:       "NOTTHESAME",
			OrgId:              dashboard.OrgID,
			TimeSettings:       timeSettings,
		}

		publicDashboardStore := &FakePublicDashboardStore{}
		publicDashboardStore.On("Find", mock.Anything, "ExistingUid").Return(pubdash, nil)
		publicDashboardStore.On("FindByDashboardUid", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrPublicDashboardNotFound.Errorf(""))
		fakeDashboardService := &dashboards.FakeDashboardService{}
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, publicDashboardStore, fakeDashboardService, nil)

		isEnabled := true
		dto := &SavePublicDashboardDTO{
			DashboardUid: "an-id",
			OrgID:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				Uid:       "ExistingUid",
				IsEnabled: &isEnabled,
			},
		}

		_, err := service.Create(context.Background(), SignedInUser, dto)
		require.Error(t, err)
		require.Equal(t, err, ErrPublicDashboardUidExists.Errorf("Create: public dashboard uid %s already exists", dto.PublicDashboard.Uid))
	})

	t.Run("Create public dashboard with given pubdash uid", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled := true

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			OrgID:        dashboard.OrgID,
			PublicDashboard: &PublicDashboardDTO{
				Uid:       "GivenUid",
				IsEnabled: &isEnabled,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		assert.Equal(t, dto.PublicDashboard.Uid, pubdash.Uid)
	})

	t.Run("Throws an error when pubdash with given access token input already exists", func(t *testing.T) {
		dashboard := dashboards.NewDashboard("testDashie")
		pubdash := &PublicDashboard{
			Uid:                "ExistingUid",
			AccessToken:        "ExistingAccessToken",
			IsEnabled:          true,
			AnnotationsEnabled: false,
			DashboardUid:       "NOTTHESAME",
			OrgId:              dashboard.OrgID,
			TimeSettings:       timeSettings,
		}

		publicDashboardStore := &FakePublicDashboardStore{}
		publicDashboardStore.On("Find", mock.Anything, mock.Anything).Return(nil, nil)
		publicDashboardStore.On("FindByAccessToken", mock.Anything, "ExistingAccessToken").Return(pubdash, nil)
		publicDashboardStore.On("FindByDashboardUid", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrPublicDashboardNotFound.Errorf(""))
		fakeDashboardService := &dashboards.FakeDashboardService{}
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)
		service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, publicDashboardStore, fakeDashboardService, nil)

		isEnabled := true
		dto := &SavePublicDashboardDTO{
			DashboardUid: "an-id",
			OrgID:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				AccessToken: "ExistingAccessToken",
				IsEnabled:   &isEnabled,
			},
		}

		_, err := service.Create(context.Background(), SignedInUser, dto)
		require.Error(t, err)
		require.Equal(t, err, ErrPublicDashboardAccessTokenExists.Errorf("Create: public dashboard access token %s already exists", dto.PublicDashboard.AccessToken))
	})

	t.Run("Create public dashboard with given pubdash access token", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]interface{}{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled := true

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			OrgID:        dashboard.OrgID,
			PublicDashboard: &PublicDashboardDTO{
				AccessToken: "GivenAccessToken",
				IsEnabled:   &isEnabled,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)

		assert.Equal(t, dto.PublicDashboard.AccessToken, pubdash.AccessToken)
	})

	t.Run("Throws an error when pubdash with generated access token already exists", func(t *testing.T) {
		dashboard := dashboards.NewDashboard("testDashie")
		pubdash := &PublicDashboard{
			IsEnabled:          true,
			AnnotationsEnabled: false,
			DashboardUid:       "NOTTHESAME",
			OrgId:              dashboard.OrgID,
			TimeSettings:       timeSettings,
		}

		publicDashboardStore := &FakePublicDashboardStore{}
		publicDashboardStore.On("FindByAccessToken", mock.Anything, mock.Anything).Return(pubdash, nil)
		service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, publicDashboardStore, nil, nil)

		_, err := service.NewPublicDashboardAccessToken(context.Background())
		require.Error(t, err)
		require.Equal(t, err, ErrInternalServerError.Errorf("failed to generate a unique accessToken for public dashboard"))
	})

	t.Run("Returns error if public dashboard exists", func(t *testing.T) {
		publicdashboardStore := &FakePublicDashboardStore{}
		publicdashboardStore.On("FindByDashboardUid", mock.Anything, mock.Anything, mock.Anything).Return(&PublicDashboard{Uid: "newPubdashUid"}, nil)
		publicdashboardStore.On("Find", mock.Anything, mock.Anything).Return(nil, nil)
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, publicdashboardStore, fakeDashboardService, nil)

		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled, annotationsEnabled := true, false
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				AnnotationsEnabled: &annotationsEnabled,
				IsEnabled:          &isEnabled,
			},
		}

		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		assert.Error(t, err)
		assert.Nil(t, savedPubdash)
		assert.True(t, ErrDashboardIsPublic.Is(err))
	})

	t.Run("Validate pubdash has default share value", func(t *testing.T) {
		fakeDashboardService := &dashboards.FakeDashboardService{}
		service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)

		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

		isEnabled := true
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			OrgID:        dashboard.OrgID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		_, err = service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		pubdash, err := service.FindByDashboardUid(context.Background(), dashboard.OrgID, dashboard.UID)
		require.NoError(t, err)
		// if share type is empty should be populated with public by default
		assert.Equal(t, PublicShareType, pubdash.Share)
	})
}

func assertFalseIfNull(t *testing.T, expectedValue bool, nullableValue *bool) {
	if nullableValue == nil {
		assert.Equal(t, expectedValue, false)
	} else {
		assert.Equal(t, expectedValue, *nullableValue)
	}
}

func TestIntegrationUpdatePublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	fakeDashboardService := &dashboards.FakeDashboardService{}
	service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)

	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
	dashboard2 := insertTestDashboard(t, dashboardStore, "testDashie2", 1, 0, "", true, []map[string]any{}, nil)
	fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

	t.Run("Updating public dashboard", func(t *testing.T) {
		isEnabled, annotationsEnabled, timeSelectionEnabled := true, false, false
		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled:            &isEnabled,
				AnnotationsEnabled:   &annotationsEnabled,
				TimeSelectionEnabled: &timeSelectionEnabled,
			},
		}

		// insert initial pubdash
		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		isEnabled, annotationsEnabled, timeSelectionEnabled = true, true, true

		dto = &SavePublicDashboardDTO{
			Uid:          savedPubdash.Uid,
			DashboardUid: dashboard.UID,
			OrgID:        9,
			UserId:       8,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled:            &isEnabled,
				AnnotationsEnabled:   &annotationsEnabled,
				TimeSelectionEnabled: &timeSelectionEnabled,
			},
		}

		updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		// don't get updated
		assert.Equal(t, savedPubdash.DashboardUid, updatedPubdash.DashboardUid)
		assert.Equal(t, savedPubdash.OrgId, updatedPubdash.OrgId)
		assert.Equal(t, savedPubdash.CreatedAt, updatedPubdash.CreatedAt)
		assert.Equal(t, savedPubdash.CreatedBy, updatedPubdash.CreatedBy)
		assert.Equal(t, savedPubdash.AccessToken, updatedPubdash.AccessToken)

		// gets updated
		assert.Equal(t, *dto.PublicDashboard.IsEnabled, updatedPubdash.IsEnabled)
		assert.Equal(t, *dto.PublicDashboard.AnnotationsEnabled, updatedPubdash.AnnotationsEnabled)
		assert.Equal(t, *dto.PublicDashboard.TimeSelectionEnabled, updatedPubdash.TimeSelectionEnabled)
		assert.Equal(t, dto.UserId, updatedPubdash.UpdatedBy)
		assert.NotEqual(t, &time.Time{}, updatedPubdash.UpdatedAt)
	})

	t.Run("Updating set empty time settings", func(t *testing.T) {
		isEnabled := true

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		dto = &SavePublicDashboardDTO{
			Uid:          savedPubdash.Uid,
			DashboardUid: dashboard.UID,
			OrgID:        9,
			UserId:       8,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		assert.Equal(t, &TimeSettings{}, updatedPubdash.TimeSettings)
	})

	t.Run("Should fail when public dashboard uid does not match dashboard uid", func(t *testing.T) {
		isEnabled := true

		dto := &SavePublicDashboardDTO{
			DashboardUid: dashboard.UID,
			UserId:       7,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}

		// insert initial pubdash
		savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
		require.NoError(t, err)

		dto = &SavePublicDashboardDTO{
			Uid:          savedPubdash.Uid,
			DashboardUid: dashboard2.UID,
			OrgID:        9,
			UserId:       8,
			PublicDashboard: &PublicDashboardDTO{
				IsEnabled: &isEnabled,
			},
		}
		_, err = service.Update(context.Background(), SignedInUser, dto)
		assert.Error(t, err)
	})

	t.Run("Updating not existent dashboard", func(t *testing.T) {
		dto := &SavePublicDashboardDTO{
			DashboardUid:    "NOTEXISTENTDASHBOARD",
			UserId:          7,
			PublicDashboard: &PublicDashboardDTO{},
		}
		fds := &dashboards.FakeDashboardService{}
		fds.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)
		service.dashboardService = fds
		updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
		assert.Error(t, err)

		var grafanaErr errutil.Error
		ok := errors.As(err, &grafanaErr)
		assert.True(t, ok)
		assert.Equal(t, "publicdashboards.dashboardNotFound", grafanaErr.MessageID)
		assert.Empty(t, updatedPubdash)
	})

	trueBooleanField := true
	timeSettings := &TimeSettings{From: "now-8", To: "now"}
	shareType := EmailShareType

	testCases := []struct {
		Name                 string
		IsEnabled            *bool
		TimeSelectionEnabled *bool
		AnnotationsEnabled   *bool
		TimeSettings         *TimeSettings
		ShareType            ShareType
	}{
		{
			Name:                 "isEnabled",
			IsEnabled:            nil,
			TimeSelectionEnabled: &trueBooleanField,
			AnnotationsEnabled:   &trueBooleanField,
			TimeSettings:         timeSettings,
			ShareType:            shareType,
		},
		{
			Name:                 "timeSelectionEnabled",
			IsEnabled:            &trueBooleanField,
			TimeSelectionEnabled: nil,
			AnnotationsEnabled:   &trueBooleanField,
			TimeSettings:         timeSettings,
			ShareType:            shareType,
		},
		{
			Name:                 "annotationsEnabled",
			IsEnabled:            &trueBooleanField,
			TimeSelectionEnabled: &trueBooleanField,
			AnnotationsEnabled:   nil,
			TimeSettings:         timeSettings,
			ShareType:            shareType,
		},
		{
			Name:                 "isEnabled, timeSelectionEnabled and annotationsEnabled",
			IsEnabled:            nil,
			TimeSelectionEnabled: nil,
			AnnotationsEnabled:   nil,
			TimeSettings:         nil,
			ShareType:            "",
		},
	}

	for _, tt := range testCases {
		t.Run(fmt.Sprintf("Update public dashboard with %s null boolean fields let those fields with old persisted value", tt.Name), func(t *testing.T) {
			fakeDashboardService := &dashboards.FakeDashboardService{}
			service, sqlStore, cfg := newPublicDashboardServiceImpl(t, nil, nil, nil, fakeDashboardService, nil)

			dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
			require.NoError(t, err)
			dashboard := insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, "", true, []map[string]any{}, nil)
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

			isEnabled, annotationsEnabled, timeSelectionEnabled := true, true, false

			dto := &SavePublicDashboardDTO{
				DashboardUid: dashboard.UID,
				UserId:       7,
				PublicDashboard: &PublicDashboardDTO{
					IsEnabled:            &isEnabled,
					AnnotationsEnabled:   &annotationsEnabled,
					TimeSelectionEnabled: &timeSelectionEnabled,
					Share:                PublicShareType,
				},
			}

			// insert initial pubdash
			savedPubdash, err := service.Create(context.Background(), SignedInUser, dto)
			require.NoError(t, err)

			dto = &SavePublicDashboardDTO{
				Uid:          savedPubdash.Uid,
				DashboardUid: dashboard.UID,
				OrgID:        9,
				UserId:       8,
				PublicDashboard: &PublicDashboardDTO{
					IsEnabled:            tt.IsEnabled,
					AnnotationsEnabled:   tt.AnnotationsEnabled,
					TimeSelectionEnabled: tt.TimeSelectionEnabled,
					Share:                tt.ShareType,
				},
			}
			updatedPubdash, err := service.Update(context.Background(), SignedInUser, dto)
			require.NoError(t, err)

			assertOldValueIfNull(t, updatedPubdash.IsEnabled, savedPubdash.IsEnabled, dto.PublicDashboard.IsEnabled)
			assertOldValueIfNull(t, updatedPubdash.AnnotationsEnabled, savedPubdash.AnnotationsEnabled, dto.PublicDashboard.AnnotationsEnabled)
			assertOldValueIfNull(t, updatedPubdash.TimeSelectionEnabled, savedPubdash.TimeSelectionEnabled, dto.PublicDashboard.TimeSelectionEnabled)

			if dto.PublicDashboard.Share == "" {
				assert.Equal(t, updatedPubdash.Share, savedPubdash.Share)
			} else {
				assert.Equal(t, updatedPubdash.Share, dto.PublicDashboard.Share)
			}
		})
	}
}

func assertOldValueIfNull(t *testing.T, expectedValue bool, oldValue bool, nullableValue *bool) {
	if nullableValue == nil {
		assert.Equal(t, expectedValue, oldValue)
	} else {
		assert.Equal(t, expectedValue, *nullableValue)
	}
}

func TestIntegrationDeletePublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	pubdash := &PublicDashboard{Uid: "2", OrgId: 1, DashboardUid: "uid"}

	type mockFindResponse struct {
		PublicDashboard *PublicDashboard
		Err             error
	}

	type mockDeleteResponse struct {
		AffectedRowsResp int64
		StoreRespErr     error
	}

	testCases := []struct {
		Name            string
		ExpectedErrResp error
		mockFindStore   *mockFindResponse
		mockDeleteStore *mockDeleteResponse
	}{
		{
			Name:            "Successfully deletes a public dashboard",
			ExpectedErrResp: nil,
			mockFindStore:   &mockFindResponse{pubdash, nil},
			mockDeleteStore: &mockDeleteResponse{1, nil},
		},
		{
			Name:            "Public dashboard not found",
			ExpectedErrResp: ErrInternalServerError.Errorf("Delete: failed to find public dashboard by uid: pubdashUID: error"),
			mockFindStore:   &mockFindResponse{pubdash, errors.New("error")},
			mockDeleteStore: &mockDeleteResponse{0, nil},
		},
		{
			Name:            "Public dashboard not found by UID",
			ExpectedErrResp: ErrPublicDashboardNotFound.Errorf("Delete: public dashboard not found by uid: pubdashUID"),
			mockFindStore:   &mockFindResponse{nil, nil},
			mockDeleteStore: &mockDeleteResponse{0, nil},
		},
		{
			Name:            "Public dashboard UID does not belong to the dashboard",
			ExpectedErrResp: ErrInvalidUid.Errorf("Delete: the public dashboard does not belong to the dashboard"),
			mockFindStore:   &mockFindResponse{&PublicDashboard{Uid: "2", OrgId: 1, DashboardUid: "wrong"}, nil},
			mockDeleteStore: &mockDeleteResponse{0, nil},
		},

		{
			Name:            "Failed to delete - Database error",
			ExpectedErrResp: ErrInternalServerError.Errorf("Delete: failed to delete a public dashboard by Uid: pubdashUID db error!"),
			mockFindStore:   &mockFindResponse{pubdash, nil},
			mockDeleteStore: &mockDeleteResponse{1, errors.New("db error!")},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.Name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("Find", mock.Anything, mock.Anything).Return(tt.mockFindStore.PublicDashboard, tt.mockFindStore.Err)
			if tt.ExpectedErrResp == nil || tt.mockDeleteStore.StoreRespErr != nil {
				store.On("Delete", mock.Anything, mock.Anything).Return(tt.mockDeleteStore.AffectedRowsResp, tt.mockDeleteStore.StoreRespErr)
			}
			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, store, nil, nil)

			err := service.Delete(context.Background(), "pubdashUID", "uid")
			if tt.ExpectedErrResp != nil {
				assert.Equal(t, tt.ExpectedErrResp.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
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

func TestPublicDashboardServiceImpl_NewPublicDashboardUid(t *testing.T) {
	mockedDashboard := &PublicDashboard{
		IsEnabled:          true,
		AnnotationsEnabled: false,
		DashboardUid:       "NOTTHESAME",
		OrgId:              9999999,
		TimeSettings:       timeSettings,
	}

	type args struct {
		ctx context.Context
	}

	type mockResponse struct {
		PublicDashboard *PublicDashboard
		Err             error
	}
	tests := []struct {
		name      string
		args      args
		mockStore *mockResponse
		want      string
		wantErr   assert.ErrorAssertionFunc
	}{
		{
			name:      "should return a new uid",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{nil, nil},
			want:      "NOTTHESAME",
			wantErr:   assert.NoError,
		},
		{
			name:      "should return an error if the generated uid exists 3 times",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{mockedDashboard, nil},
			want:      "",
			wantErr:   assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("Find", mock.Anything, mock.Anything).
				Return(tt.mockStore.PublicDashboard, tt.mockStore.Err)

			pd := &PublicDashboardServiceImpl{store: store}

			got, err := pd.NewPublicDashboardUid(tt.args.ctx)
			if !tt.wantErr(t, err, fmt.Sprintf("NewPublicDashboardUid(%v)", tt.args.ctx)) {
				return
			}

			if err == nil {
				assert.NotEqual(t, got, tt.want, "NewPublicDashboardUid(%v)", tt.args.ctx)
				assert.True(t, util.IsValidShortUID(got), "NewPublicDashboardUid(%v)", tt.args.ctx)
				store.AssertNumberOfCalls(t, "Find", 1)
			} else {
				store.AssertNumberOfCalls(t, "Find", 3)
				assert.True(t, ErrInternalServerError.Is(err))
			}
		})
	}
}

func TestPublicDashboardServiceImpl_NewPublicDashboardAccessToken(t *testing.T) {
	mockedDashboard := &PublicDashboard{
		IsEnabled:          true,
		AnnotationsEnabled: false,
		DashboardUid:       "NOTTHESAME",
		OrgId:              9999999,
		TimeSettings:       timeSettings,
	}

	type args struct {
		ctx context.Context
	}

	type mockResponse struct {
		PublicDashboard *PublicDashboard
		Err             error
	}
	tests := []struct {
		name      string
		args      args
		mockStore *mockResponse
		want      string
		wantErr   assert.ErrorAssertionFunc
	}{
		{
			name:      "should return a new access token",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{nil, nil},
			want:      "6522e152530f4ee76522e152530f4ee7",
			wantErr:   assert.NoError,
		},
		{
			name:      "should return an error if the generated access token exists 3 times",
			args:      args{ctx: context.Background()},
			mockStore: &mockResponse{mockedDashboard, nil},
			want:      "",
			wantErr:   assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewFakePublicDashboardStore(t)
			store.On("FindByAccessToken", mock.Anything, mock.Anything).
				Return(tt.mockStore.PublicDashboard, tt.mockStore.Err)

			pd := &PublicDashboardServiceImpl{store: store}

			got, err := pd.NewPublicDashboardAccessToken(tt.args.ctx)
			if !tt.wantErr(t, err, fmt.Sprintf("NewPublicDashboardAccessToken(%v)", tt.args.ctx)) {
				return
			}

			if err == nil {
				assert.NotEqual(t, got, tt.want, "NewPublicDashboardAccessToken(%v)", tt.args.ctx)
				assert.True(t, validation.IsValidAccessToken(got), "NewPublicDashboardAccessToken(%v)", tt.args.ctx)
				store.AssertNumberOfCalls(t, "FindByAccessToken", 1)
			} else {
				store.AssertNumberOfCalls(t, "FindByAccessToken", 3)
				assert.True(t, ErrInternalServerError.Is(err))
			}
		})
	}
}

func TestGenerateAccessToken(t *testing.T) {
	accessToken, err := GenerateAccessToken()

	t.Run("length", func(t *testing.T) {
		require.NoError(t, err)
		assert.Equal(t, 32, len(accessToken))
	})

	t.Run("no - ", func(t *testing.T) {
		assert.False(t, strings.Contains("-", accessToken))
	})
}

func CreateDatasource(dsType string, uid string) struct {
	Type *string `json:"type,omitempty"`
	Uid  *string `json:"uid,omitempty"`
} {
	return struct {
		Type *string `json:"type,omitempty"`
		Uid  *string `json:"uid,omitempty"`
	}{
		Type: &dsType,
		Uid:  &uid,
	}
}

func AddAnnotationsToDashboard(t *testing.T, dash *dashboards.Dashboard, annotations []DashAnnotation) *dashboards.Dashboard {
	type annotationsDto struct {
		List []DashAnnotation `json:"list"`
	}
	annos := annotationsDto{}
	annos.List = annotations
	annoJSON, err := json.Marshal(annos)
	require.NoError(t, err)

	dashAnnos, err := simplejson.NewJson(annoJSON)
	require.NoError(t, err)

	dash.Data.Set("annotations", dashAnnos)

	return dash
}

func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64,
	folderId int64, folderUID string, isFolder bool, templateVars []map[string]any, customPanels []any, tags ...any,
) *dashboards.Dashboard {
	t.Helper()

	var dashboardPanels []any
	if customPanels != nil {
		dashboardPanels = customPanels
	} else {
		dashboardPanels = []any{
			map[string]any{
				"id": 1,
				"datasource": map[string]any{
					"uid": "ds1",
				},
				"targets": []any{
					map[string]any{
						"datasource": map[string]any{
							"type": "mysql",
							"uid":  "ds1",
						},
						"refId": "A",
					},
					map[string]any{
						"datasource": map[string]any{
							"type": "prometheus",
							"uid":  "ds2",
						},
						"refId": "B",
					},
				},
			},
			map[string]any{
				"id": 2,
				"datasource": map[string]any{
					"uid": "ds3",
				},
				"targets": []any{
					map[string]any{
						"datasource": map[string]any{
							"type": "mysql",
							"uid":  "ds3",
						},
						"refId": "C",
					},
				},
			},
		}
	}

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		FolderUID: folderUID,
		IsFolder:  isFolder,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":     nil,
			"title":  title,
			"tags":   tags,
			"panels": dashboardPanels,
			"templating": map[string]any{
				"list": templateVars,
			},
			"time": map[string]any{
				"from": "2022-09-01T00:00:00.000Z",
				"to":   "2022-09-01T12:00:00.000Z",
			},
		}),
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}
