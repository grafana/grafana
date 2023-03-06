package models

import (
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	"github.com/stretchr/testify/assert"
)

func TestPublicDashboardTableName(t *testing.T) {
	assert.Equal(t, "dashboard_public", PublicDashboard{}.TableName())
}

func TestBuildTimeSettings(t *testing.T) {
	var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "2022-09-01T00:00:00.000Z", "to": "2022-09-01T12:00:00.000Z"}})
	defaultFromMs, defaultToMs := internal.GetTimeRangeFromDashboard(t, dashboardData)

	selectionFromMs := strconv.FormatInt(time.Now().UnixMilli(), 10)
	selectionToMs := strconv.FormatInt(time.Now().Add(time.Hour).UnixMilli(), 10)

	testCases := []struct {
		name       string
		dashboard  *dashboards.Dashboard
		pubdash    *PublicDashboard
		timeResult TimeSettings
		reqDTO     PublicDashboardQueryDTO
	}{
		{
			name:      "should use dashboard time if pubdash time empty",
			dashboard: &dashboards.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{TimeSelectionEnabled: false},
			timeResult: TimeSettings{
				From: defaultFromMs,
				To:   defaultToMs,
			},
			reqDTO: PublicDashboardQueryDTO{},
		},
		{
			name:      "should use dashboard time when time selection is disabled",
			dashboard: &dashboards.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{TimeSelectionEnabled: false, TimeSettings: &TimeSettings{From: "now-12", To: "now"}},
			timeResult: TimeSettings{
				From: defaultFromMs,
				To:   defaultToMs,
			},
			reqDTO: PublicDashboardQueryDTO{},
		},
		{
			name:      "should use selected values if time selection is enabled",
			dashboard: &dashboards.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{TimeSelectionEnabled: true, TimeSettings: &TimeSettings{From: "now-12", To: "now"}},
			reqDTO: PublicDashboardQueryDTO{
				TimeRange: TimeSettings{
					From: selectionFromMs,
					To:   selectionToMs,
				},
			},
			timeResult: TimeSettings{
				From: selectionFromMs,
				To:   selectionToMs,
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.timeResult, test.pubdash.BuildTimeSettings(test.dashboard, test.reqDTO))
		})
	}
}
