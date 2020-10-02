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
	require.Nil(t, err)
	to, err := timeRange.ParseTo()
	require.Nil(t, err)

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
		require.Nil(t, err)
		assert.Equal(t, res.Region, "us-east-1")
		assert.Equal(t, res.RefId, "ref1")
		assert.Equal(t, res.Namespace, "ec2")
		assert.Equal(t, res.MetricName, "CPUUtilization")
		assert.Equal(t, res.Id, "")
		assert.Equal(t, res.Expression, "")
		assert.Equal(t, res.Period, 600)
		assert.Equal(t, res.ReturnData, true)
		assert.Equal(t, len(res.Dimensions), 2)
		assert.Equal(t, len(res.Dimensions["InstanceId"]), 1)
		assert.Equal(t, len(res.Dimensions["InstanceType"]), 2)
		assert.Equal(t, res.Dimensions["InstanceType"][1], "test3")
		assert.Equal(t, len(res.Statistics), 1)
		assert.Equal(t, *res.Statistics[0], "Average")
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
		require.Nil(t, err)
		assert.Equal(t, res.Region, "us-east-1")
		assert.Equal(t, res.RefId, "ref1")
		assert.Equal(t, res.Namespace, "ec2")
		assert.Equal(t, res.MetricName, "CPUUtilization")
		assert.Equal(t, res.Id, "")
		assert.Equal(t, res.Expression, "")
		assert.Equal(t, res.Period, 600)
		assert.Equal(t, res.ReturnData, true)
		assert.Equal(t, len(res.Dimensions), 2)
		assert.Equal(t, len(res.Dimensions["InstanceId"]), 1)
		assert.Equal(t, len(res.Dimensions["InstanceType"]), 1)
		assert.Equal(t, res.Dimensions["InstanceType"][0], "test2")
		assert.Equal(t, *res.Statistics[0], "Average")
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
		require.Nil(t, err)
		to, err := timeRange.ParseTo()
		require.Nil(t, err)

		res, err := parseRequestQuery(query, "ref1", from, to)
		require.Nil(t, err)
		assert.Equal(t, res.Period, 900)
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
			require.Nil(t, err)
			assert.Equal(t, res.Period, 60)
		})

		t.Run("Time range is 1 day", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -1)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 60)
		})

		t.Run("Time range is 2 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -2)
			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 300)
		})

		t.Run("Time range is 7 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -7)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 900)
		})

		t.Run("Time range is 30 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -30)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 3600)
		})

		t.Run("Time range is 90 days", func(t *testing.T) {
			query.Set("period", "auto")
			to := time.Now()
			from := to.AddDate(0, 0, -90)

			res, err := parseRequestQuery(query, "ref1", from, to)
			require.Nil(t, err)
			assert.Equal(t, res.Period, 21600)
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
			require.Nil(t, err)
			assert.Equal(t, res.Period, 86400)
		})
	})
}
