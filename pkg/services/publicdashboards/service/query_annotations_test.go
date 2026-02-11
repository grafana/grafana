package service

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashboard2 "github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestIntegrationFindAnnotationsTimerange(t *testing.T) {
	t.Run("use request time range when time selection is enabled, dashboard time range when disabled", func(t *testing.T) {
		dash := dashboards.NewDashboard("test")
		grafanaAnnotation := DashAnnotation{
			Datasource: CreateDatasource("grafana", "grafana"),
			Enable:     true,
			Name:       "annoName",
			IconColor:  "red",
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

		dashboard.Data.SetPath([]string{"time", "from"}, "2026-01-01T00:00:00.000Z")
		dashboard.Data.SetPath([]string{"time", "to"}, "2026-01-01T12:00:00.000Z")
		dashboard.Data.SetPath([]string{"timezone"}, "UTC")

		defaultFromStr, defaultToStr := internal.GetTimeRangeFromDashboard(t, dashboard.Data)
		defaultFromMs, _ := strconv.ParseInt(defaultFromStr, 10, 64)
		defaultToMs, _ := strconv.ParseInt(defaultToStr, 10, 64)
		requestFromMs := int64(1000000000000)
		requestToMs := int64(2000000000000)

		annotationsRepo := &annotations.FakeAnnotationsRepo{}

		t.Run("time selection enabled, use request time range", func(t *testing.T) {
			pubdash := &PublicDashboard{
				Uid:                  "uid1",
				IsEnabled:            true,
				OrgId:                1,
				DashboardUid:         dashboard.UID,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: true,
			}
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, annotationsRepo)

			var capturedQuery *annotations.ItemQuery
			annotationsRepo.On("Find", mock.Anything, mock.MatchedBy(func(query *annotations.ItemQuery) bool {
				capturedQuery = query
				return true
			})).Return([]*annotations.ItemDTO{
				{
					ID:          1,
					DashboardID: 1,
					PanelID:     1,
					Tags:        []string{},
					TimeEnd:     1,
					Time:        2,
					Text:        "text",
				},
			}, nil).Once()

			reqDTO := AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			}

			items, err := service.FindAnnotations(context.Background(), reqDTO, "abc123")
			require.NoError(t, err)
			require.NotNil(t, capturedQuery)
			assert.Equal(t, requestFromMs, capturedQuery.From)
			assert.Equal(t, requestToMs, capturedQuery.To)
			assert.Len(t, items, 1)
		})

		t.Run("time selection disabled, use dashboard default time range", func(t *testing.T) {
			pubdash := &PublicDashboard{
				Uid:                  "uid2",
				IsEnabled:            true,
				OrgId:                1,
				DashboardUid:         dashboard.UID,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: false,
			}
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, annotationsRepo)

			var capturedQuery *annotations.ItemQuery
			annotationsRepo.On("Find", mock.Anything, mock.MatchedBy(func(query *annotations.ItemQuery) bool {
				capturedQuery = query
				return true
			})).Return([]*annotations.ItemDTO{
				{
					ID:          1,
					DashboardID: 1,
					PanelID:     1,
					Tags:        []string{},
					TimeEnd:     1,
					Time:        2,
					Text:        "text",
				},
			}, nil).Once()

			reqDTO := AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			}

			items, err := service.FindAnnotations(context.Background(), reqDTO, "abc123")
			require.NoError(t, err)
			require.NotNil(t, capturedQuery)
			assert.Equal(t, defaultFromMs, capturedQuery.From)
			assert.Equal(t, defaultToMs, capturedQuery.To)
			assert.Len(t, items, 1)
		})

		t.Run("time selection disabled, no annotations in dashboard default time range", func(t *testing.T) {
			// Annotation time range outside of dashboard time range
			outOfRangeTime, _ := time.Parse(time.RFC3339, "2025-01-01T00:00:00.000Z")
			outOfRangeTimeMs := outOfRangeTime.UnixMilli()

			pubdash := &PublicDashboard{
				Uid:                  "uid2",
				IsEnabled:            true,
				OrgId:                1,
				DashboardUid:         dashboard.UID,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: false,
			}
			fakeStore := &FakePublicDashboardStore{}
			fakeStore.On("FindByAccessToken", mock.Anything, mock.AnythingOfType("string")).Return(pubdash, nil)
			fakeDashboardService := &dashboards.FakeDashboardService{}
			fakeDashboardService.On("GetDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashboard, nil)

			service, _, _ := newPublicDashboardServiceImpl(t, nil, nil, fakeStore, fakeDashboardService, annotationsRepo)

			var capturedQuery *annotations.ItemQuery
			annotationsRepo.On("Find", mock.Anything, mock.MatchedBy(func(query *annotations.ItemQuery) bool {
				capturedQuery = query
				return query.From == defaultFromMs && query.To == defaultToMs
			})).Return([]*annotations.ItemDTO{
				{
					ID:          1,
					DashboardID: 1,
					PanelID:     1,
					Tags:        []string{},
					TimeEnd:     outOfRangeTimeMs + 1000,
					Time:        outOfRangeTimeMs,
					Text:        "outside dashboard time range",
				},
			}, nil).Once()

			reqDTO := AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			}

			items, err := service.FindAnnotations(context.Background(), reqDTO, "abc123")
			// Mock will return the annotation, but real query will filter so check that the time range used is correct
			require.NoError(t, err)
			require.NotNil(t, capturedQuery)
			assert.Equal(t, defaultFromMs, capturedQuery.From)
			assert.Equal(t, defaultToMs, capturedQuery.To)
			assert.Len(t, items, 1)
			assert.Less(t, outOfRangeTimeMs, capturedQuery.To)
		})
	})
}

func TestGetAnnotationsTimeRange(t *testing.T) {
	var defaultV1DashboardData = simplejson.NewFromAny(map[string]interface{}{
		"time": map[string]interface{}{
			"from": "2026-01-01T00:00:00.000Z",
			"to":   "2026-01-01T12:00:00.000Z",
		},
		"timezone": "Europe/London",
	})
	var defaultV2DashboardData = simplejson.NewFromAny(map[string]interface{}{
		"elements": map[string]interface{}{
			"panel1": map[string]interface{}{},
		},
		"timeSettings": map[string]interface{}{
			"from":     "2026-01-01T00:00:00.000Z",
			"to":       "2026-01-01T12:00:00.000Z",
			"timezone": "Europe/London",
		},
	})

	defaultFromMsStr, defaultToMsStr := internal.GetTimeRangeFromDashboard(t, defaultV1DashboardData)
	defaultFromMs, _ := strconv.ParseInt(defaultFromMsStr, 10, 64)
	defaultToMs, _ := strconv.ParseInt(defaultToMsStr, 10, 64)

	fakeTimezone, _ := time.LoadLocation("Europe/Madrid")
	fakeNow := time.Date(2016, 01, 01, 00, 00, 0, 0, fakeTimezone)
	startOfYesterdayMadrid, endOfYesterdayMadrid := getStartAndEndOfTheDayBefore(fakeNow, "Europe/Madrid")
	startOfYesterdayUTC, endOfYesterdayUTC := getStartAndEndOfTheDayBefore(fakeNow, "UTC")

	NewTimeRange = func(from, to string) gtime.TimeRange {
		return gtime.TimeRange{
			From: from,
			To:   to,
			Now:  fakeNow,
		}
	}

	requestFromMs := int64(1000000000000)
	requestToMs := int64(2000000000000)

	testCases := []struct {
		name                 string
		dashboard            *dashboards.Dashboard
		reqDTO               AnnotationsQueryDTO
		timeSelectionEnabled bool
		wantFrom             int64
		wantTo               int64
	}{
		{
			name:      "time selection enabled, should use request time range",
			dashboard: &dashboards.Dashboard{Data: defaultV1DashboardData},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: true,
			wantFrom:             requestFromMs,
			wantTo:               requestToMs,
		},
		{
			name: "time selection enabled, dashboard relative time range",
			dashboard: &dashboards.Dashboard{
				Data: buildJsonDataWithTimeRange("now-1d/d", "now-1d/d", "Europe/Madrid"),
			},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: true,
			wantFrom:             requestFromMs,
			wantTo:               requestToMs,
		},
		{
			name:      "time selection disabled, should use dashboard time range",
			dashboard: &dashboards.Dashboard{Data: defaultV1DashboardData},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: false,
			wantFrom:             defaultFromMs,
			wantTo:               defaultToMs,
		},
		{
			name: "time selection disabled, dashboard relative time range",
			dashboard: &dashboards.Dashboard{
				Data: buildJsonDataWithTimeRange("now-1d/d", "now-1d/d", "Europe/Madrid"),
			},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: false,
			wantFrom:             startOfYesterdayMadrid.UnixMilli(),
			wantTo:               endOfYesterdayMadrid.UnixMilli(),
		},
		{
			name: "time selection disabled, dashboard relative time range with unknown timezone",
			dashboard: &dashboards.Dashboard{
				Data: buildJsonDataWithTimeRange("now-1d/d", "now-1d/d", ""),
			},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: false,
			wantFrom:             startOfYesterdayUTC.UnixMilli(),
			wantTo:               endOfYesterdayUTC.UnixMilli(),
		},
		{
			name: "time selection disabled, dashboard relative time range for the last hour",
			dashboard: &dashboards.Dashboard{
				Data: buildJsonDataWithTimeRange("now-1h", "now", "Europe/Madrid"),
			},
			reqDTO: AnnotationsQueryDTO{
				From: 0,
				To:   0,
			},
			timeSelectionEnabled: false,
			wantFrom:             fakeNow.Add(-time.Hour).UnixMilli(),
			wantTo:               fakeNow.UnixMilli(),
		},
		{
			name:      "time selection enabled, v2 dashboard, should use request time range",
			dashboard: &dashboards.Dashboard{Data: defaultV2DashboardData},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: true,
			wantFrom:             requestFromMs,
			wantTo:               requestToMs,
		},
		{
			name:      "time selection disabled, v2 dashboard, should use dashboard time range",
			dashboard: &dashboards.Dashboard{Data: defaultV2DashboardData},
			reqDTO: AnnotationsQueryDTO{
				From: requestFromMs,
				To:   requestToMs,
			},
			timeSelectionEnabled: false,
			wantFrom:             defaultFromMs,
			wantTo:               defaultToMs,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			from, to := getAnnotationsTimeRange(test.dashboard, test.reqDTO, test.timeSelectionEnabled)
			assert.Equal(t, test.wantFrom, from, "From time should match")
			assert.Equal(t, test.wantTo, to, "To time should match")
		})
	}
}
