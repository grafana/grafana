package models

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	"github.com/stretchr/testify/assert"
)

func TestPublicDashboardTableName(t *testing.T) {
	assert.Equal(t, "dashboard_public", PublicDashboard{}.TableName())
}

func TestBuildTimeSettings(t *testing.T) {
	var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "2022-09-01T00:00:00.000Z", "to": "2022-09-01T12:00:00.000Z"}})
	fromMs, toMs := internal.GetTimeRangeFromDashboard(t, dashboardData)
	testCases := []struct {
		name       string
		dashboard  *models.Dashboard
		pubdash    *PublicDashboard
		timeResult TimeSettings
	}{
		{
			name:      "should use dashboard time if pubdash time empty",
			dashboard: &models.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{},
			timeResult: TimeSettings{
				From: fromMs,
				To:   toMs,
			},
		},
		{
			name:      "should use dashboard time even if pubdash time exists",
			dashboard: &models.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{TimeSettings: simplejson.NewFromAny(map[string]interface{}{"from": "now-12", "to": "now"})},
			timeResult: TimeSettings{
				From: fromMs,
				To:   toMs,
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.timeResult, test.pubdash.BuildTimeSettings(test.dashboard))
		})
	}
}
