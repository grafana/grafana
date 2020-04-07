package cloudwatch

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestRequestParser(t *testing.T) {
	Convey("TestRequestParser", t, func() {
		timeRange := tsdb.NewTimeRange("now-1h", "now-2h")
		from, _ := timeRange.ParseFrom()
		to, _ := timeRange.ParseTo()
		Convey("when parsing query editor row json", func() {
			Convey("using new dimensions structure", func() {
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
				So(err, ShouldBeNil)
				So(res.Region, ShouldEqual, "us-east-1")
				So(res.RefId, ShouldEqual, "ref1")
				So(res.Namespace, ShouldEqual, "ec2")
				So(res.MetricName, ShouldEqual, "CPUUtilization")
				So(res.Id, ShouldEqual, "")
				So(res.Expression, ShouldEqual, "")
				So(res.Period, ShouldEqual, 600)
				So(res.ReturnData, ShouldEqual, true)
				So(len(res.Dimensions), ShouldEqual, 2)
				So(len(res.Dimensions["InstanceId"]), ShouldEqual, 1)
				So(len(res.Dimensions["InstanceType"]), ShouldEqual, 2)
				So(res.Dimensions["InstanceType"][1], ShouldEqual, "test3")
				So(len(res.Statistics), ShouldEqual, 1)
				So(*res.Statistics[0], ShouldEqual, "Average")
			})

			Convey("using old dimensions structure (backwards compatibility)", func() {
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
				So(err, ShouldBeNil)
				So(res.Region, ShouldEqual, "us-east-1")
				So(res.RefId, ShouldEqual, "ref1")
				So(res.Namespace, ShouldEqual, "ec2")
				So(res.MetricName, ShouldEqual, "CPUUtilization")
				So(res.Id, ShouldEqual, "")
				So(res.Expression, ShouldEqual, "")
				So(res.Period, ShouldEqual, 600)
				So(res.ReturnData, ShouldEqual, true)
				So(len(res.Dimensions), ShouldEqual, 2)
				So(len(res.Dimensions["InstanceId"]), ShouldEqual, 1)
				So(len(res.Dimensions["InstanceType"]), ShouldEqual, 1)
				So(res.Dimensions["InstanceType"][0], ShouldEqual, "test2")
				So(*res.Statistics[0], ShouldEqual, "Average")
			})

			Convey("period defined in the editor by the user is being used", func() {
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
				Convey("when time range is short", func() {
					query.Set("period", "900")
					timeRange := tsdb.NewTimeRange("now-1h", "now-2h")
					from, _ := timeRange.ParseFrom()
					to, _ := timeRange.ParseTo()

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 900)
				})
			})

			Convey("period is parsed correctly if not defined by user", func() {
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

				Convey("when time range is 5 minutes", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.Local().Add(time.Minute * time.Duration(5))

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 60)
				})

				Convey("when time range is 1 day", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(0, 0, -1)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 60)
				})

				Convey("when time range is 2 days", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(0, 0, -2)
					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 300)
				})

				Convey("when time range is 7 days", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(0, 0, -7)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 900)
				})

				Convey("when time range is 30 days", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(0, 0, -30)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 3600)
				})

				Convey("when time range is 90 days", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(0, 0, -90)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 21600)
				})

				Convey("when time range is 1 year", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(-1, 0, 0)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 21600)
				})

				Convey("when time range is 2 years", func() {
					query.Set("period", "auto")
					to := time.Now()
					from := to.AddDate(-2, 0, 0)

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 86400)
				})
			})

		})
	})
}
