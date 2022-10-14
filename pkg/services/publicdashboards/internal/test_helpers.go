package internal

import (
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

// Gets time range from dashboard in unix milliseconds
func GetTimeRangeFromDashboard(t *testing.T, dashboardData *simplejson.Json) (string, string) {
	to := dashboardData.GetPath("time", "to").MustString()
	from := dashboardData.GetPath("time", "from").MustString()
	toTime, err := time.Parse("2006-01-02T15:04:05.000Z", to)
	require.NoError(t, err)
	fromTime, err := time.Parse("2006-01-02T15:04:05.000Z", from)
	require.NoError(t, err)
	toUnixMilli := strconv.FormatInt(toTime.UnixMilli(), 10)
	fromUnixMilli := strconv.FormatInt(fromTime.UnixMilli(), 10)

	return fromUnixMilli, toUnixMilli
}

func CreateDashboardFromFile(t *testing.T, path string) *models.Dashboard {
	json, err := os.ReadFile(path)
	require.Nil(t, err)
	dashJSON, err := simplejson.NewJson(json)
	require.Nil(t, err)

	return models.NewDashboardFromJson(dashJSON)
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
