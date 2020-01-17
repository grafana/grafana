package cloudwatch

import (
	"testing"

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

				Convey("when time range is short", func() {
					query.Set("period", "auto")
					timeRange := tsdb.NewTimeRange("now-2h", "now-1h")
					from, _ := timeRange.ParseFrom()
					to, _ := timeRange.ParseTo()

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 60)
				})

				Convey("when time range is 5y", func() {
					timeRange := tsdb.NewTimeRange("now-5y", "now")
					from, _ := timeRange.ParseFrom()
					to, _ := timeRange.ParseTo()

					res, err := parseRequestQuery(query, "ref1", from, to)
					So(err, ShouldBeNil)
					So(res.Period, ShouldEqual, 21600)
				})
			})

			Convey("closest works as expected", func() {
				periods := []int{60, 300, 900, 3600, 21600}
				Convey("and input is lower than 60", func() {
					So(closest(periods, 6), ShouldEqual, 60)
				})

				Convey("and input is exactly 60", func() {
					So(closest(periods, 60), ShouldEqual, 60)
				})

				Convey("and input is exactly between two steps", func() {
					So(closest(periods, 180), ShouldEqual, 300)
				})

				Convey("and input is exactly 2000", func() {
					So(closest(periods, 2000), ShouldEqual, 900)
				})

				Convey("and input is exactly 5000", func() {
					So(closest(periods, 5000), ShouldEqual, 3600)
				})

				Convey("and input is exactly 50000", func() {
					So(closest(periods, 50000), ShouldEqual, 21600)
				})

				Convey("and period isn't shorter than min retension for 15 days", func() {
					So(closest(periods, (60*60*24*15)+1/2000), ShouldBeGreaterThanOrEqualTo, 300)
				})

				Convey("and period isn't shorter than min retension for 63 days", func() {
					So(closest(periods, (60*60*24*63)+1/2000), ShouldBeGreaterThanOrEqualTo, 3600)
				})

				Convey("and period isn't shorter than min retension for 455 days", func() {
					So(closest(periods, (60*60*24*455)+1/2000), ShouldBeGreaterThanOrEqualTo, 21600)
				})
			})
		})
	})
}
