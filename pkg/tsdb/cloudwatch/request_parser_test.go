package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestRequestParser(t *testing.T) {
	Convey("TestRequestParser", t, func() {
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

				res, err := parseRequestQuery(query, "ref1")
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

				res, err := parseRequestQuery(query, "ref1")
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
		})
	})
}
