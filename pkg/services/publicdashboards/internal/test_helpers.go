package internal

import (
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
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
