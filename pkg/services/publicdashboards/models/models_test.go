package models

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestPublicDashboardTableName(t *testing.T) {
	assert.Equal(t, "dashboard_public", PublicDashboard{}.TableName())
}

func TestBuildTimeSettings(t *testing.T) {
	var dashboardData = simplejson.NewFromAny(map[string]interface{}{"time": map[string]interface{}{"from": "now-8", "to": "now"}})
	testCases := []struct {
		name       string
		dashboard  *models.Dashboard
		pubdash    *PublicDashboard
		timeResult *TimeSettings
	}{
		{
			name:      "should use dashboard time if pubdash time empty",
			dashboard: &models.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{},
			timeResult: &TimeSettings{
				From: "now-8",
				To:   "now",
			},
		},
		{
			name:      "should use dashboard time if pubdash to/from empty",
			dashboard: &models.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{},
			timeResult: &TimeSettings{
				From: "now-8",
				To:   "now",
			},
		},
		{
			name:      "should use pubdash time",
			dashboard: &models.Dashboard{Data: dashboardData},
			pubdash:   &PublicDashboard{TimeSettings: simplejson.NewFromAny(map[string]interface{}{"from": "now-12", "to": "now"})},
			timeResult: &TimeSettings{
				From: "now-12",
				To:   "now",
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.timeResult, test.pubdash.BuildTimeSettings(test.dashboard))
		})
	}
}
