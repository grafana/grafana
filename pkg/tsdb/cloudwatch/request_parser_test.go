package cloudwatch

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestParser(t *testing.T) {
	timeRange := tsdb.NewTimeRange("now-1h", "now-2h")
	from, err := timeRange.ParseFrom()
	require.NoError(t, err)
	to, err := timeRange.ParseTo()
	require.NoError(t, err)

	t.Run("New dimensions structure", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"refId":      "ref1",
			"region":     "us-east-1",
			"namespace":  "ec2",
			"metricName": "CPUUtilization",
			"id":         "",
			"expression": "",
			"dimensions": map[string]interface{}{
				"InstanceId":   []interface{}{"test"},
				"InstanceType": []interface{}{"test2", "test3"},
			},
			"statistics": []interface{}{"Average"},
			"period":     "600",
			"hide":       false,
		})

		res, err := parseRequestQuery(query, "ref1", from, to)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", res.Region)
		assert.Equal(t, "ref1", res.RefId)
		assert.Equal(t, "ec2", res.Namespace)
		assert.Equal(t, "CPUUtilization", res.MetricName)
		assert.Empty(t, res.Id)
		assert.Empty(t, res.Expression)
		assert.Equal(t, 600, res.Period)
		assert.True(t, res.ReturnData)
		assert.Len(t, res.Dimensions, 2)
		assert.Len(t, res.Dimensions["InstanceId"], 1)
		assert.Len(t, res.Dimensions["InstanceType"], 2)
		assert.Equal(t, "test3", res.Dimensions["InstanceType"][1])
		assert.Len(t, res.Statistics, 1)
		assert.Equal(t, "Average", *res.Statistics[0])
	})

	t.Run("Old dimensions structure (backwards compatibility)", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"refId":      "ref1",
			"region":     "us-east-1",
			"namespace":  "ec2",
			"metricName": "CPUUtilization",
			"id":         "",
			"expression": "",
			"dimensions": map[string]interface{}{
				"InstanceId":   "test",
				"InstanceType": "test2",
			},
			"statistics": []interface{}{"Average"},
			"period":     "600",
			"hide":       false,
		})

		res, err := parseRequestQuery(query, "ref1", from, to)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", res.Region)
		assert.Equal(t, "ref1", res.RefId)
		assert.Equal(t, "ec2", res.Namespace)
		assert.Equal(t, "CPUUtilization", res.MetricName)
		assert.Empty(t, res.Id)
		assert.Empty(t, res.Expression)
		assert.Equal(t, 600, res.Period)
		assert.True(t, res.ReturnData)
		assert.Len(t, res.Dimensions, 2)
		assert.Len(t, res.Dimensions["InstanceId"], 1)
		assert.Len(t, res.Dimensions["InstanceType"], 1)
		assert.Equal(t, "test2", res.Dimensions["InstanceType"][0])
		assert.Equal(t, "Average", *res.Statistics[0])
	})

	t.Run("Period defined in the editor by the user is being used when time range is short", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"refId":      "ref1",
			"region":     "us-east-1",
			"namespace":  "ec2",
			"metricName": "CPUUtilization",
			"id":         "",
			"expression": "",
			"dimensions": map[string]interface{}{
				"InstanceId":   "test",
				"InstanceType": "test2",
			},
			"statistics": []interface{}{"Average"},
			"hide":       false,
		})
		query.Set("period", "900")
		timeRange := tsdb.NewTimeRange("now-1h", "now-2h")
		from, err := timeRange.ParseFrom()
		require.NoError(t, err)
		to, err := timeRange.ParseTo()
		require.NoError(t, err)

		res, err := parseRequestQuery(query, "ref1", from, to)
		require.NoError(t, err)
		assert.Equal(t, 900, res.Period)
	})

	t.Run("Period is parsed correctly if not defined by user", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"refId":      "ref1",
			"region":     "us-east-1",
			"namespace":  "ec2",
			"metricName": "CPUUtilization",
			"id":         "",
			"expression": "",
			"dimensions": map[string]interface{}{
				"InstanceId":   "test",
				"InstanceType": "test2",
			},
			"statistics": []interface{}{"Average"},
			"hide":       false,
			"period":     "auto",
		})

		t.Run("Time range is 5 minutes", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.Local().Add(time.Minute * time.Duration(5))

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 60, res.Period)
		})

		t.Run("Time range is 1 day", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -1)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 60, res.Period)
		})

		t.Run("Time range is 2 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 300, res.Period)
		})

		t.Run("Time range is 7 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -7)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 900, res.Period)
		})

		t.Run("Time range is 30 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -30)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 3600, res.Period)
		})

		t.Run("Time range is 90 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -90)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 21600, res.Period)
		})

		t.Run("Time range is 1 year", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(-1, 0, 0)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 21600)
		})

		t.Run("Time range is 2 years", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(-2, 0, 0)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.NoError(t, err)
			assert.Equal(t, 86400, res.Period)
		})
	})
}
