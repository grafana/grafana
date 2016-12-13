package mqe

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMQEQueryParser(t *testing.T) {
	Convey("MQE query parser", t, func() {
		parser := &QueryParser{}

		dsInfo := &models.DataSource{JsonData: simplejson.New()}
		queryContext := &tsdb.QueryContext{}

		Convey("can parse simple mqe model", func() {
			json := `
      {
        "apps": [],
        "hosts": [
          "staples-lab-1"
        ],
        "metrics": [
          {
            "metric": "os.cpu.all*"
          }
        ],
        "rawQuery": "",
        "refId": "A"
      }
      `
			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			query, err := parser.Parse(modelJson, dsInfo, queryContext)
			So(err, ShouldBeNil)
			So(query.UseRawQuery, ShouldBeFalse)

			So(len(query.Apps), ShouldEqual, 0)
			So(query.Hosts[0], ShouldEqual, "staples-lab-1")
			So(query.Metrics[0].Metric, ShouldEqual, "os.cpu.all*")
		})

		Convey("can parse multi serie mqe model", func() {
			json := `
      {
        "apps": [
          "demoapp"
        ],
        "hosts": [
          "staples-lab-1"
        ],
        "metrics": [
          {
            "metric": "os.cpu.all.active_percentage"
          },
          {
            "metric": "os.disk.sda.io_time"
          }
        ],
        "rawQuery": "",
        "refId": "A",
        "addAppToAlias": true,
        "addHostToAlias": true
      }
      `
			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			query, err := parser.Parse(modelJson, dsInfo, queryContext)
			So(err, ShouldBeNil)
			So(query.UseRawQuery, ShouldBeFalse)
			So(query.Apps[0], ShouldEqual, "demoapp")
			So(query.Metrics[0].Metric, ShouldEqual, "os.cpu.all.active_percentage")
			So(query.Metrics[1].Metric, ShouldEqual, "os.disk.sda.io_time")
		})

		Convey("can parse raw query", func() {
			json := `
      {
        "addAppToAlias": true,
        "addHostToAlias": true,
        "apps": [],
        "hosts": [
          "staples-lab-1"
        ],
        "metrics": [
          {
            "alias": "cpu active",
            "metric": "os.cpu.all.active_percentage"
          },
          {
            "alias": "disk sda time",
            "metric": "os.disk.sda.io_time"
          }
        ],
        "rawQuery": true,
        "query": "raw-query",
        "refId": "A",
        "addAppToAlias": true,
        "addHostToAlias": true
      }
      `
			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			query, err := parser.Parse(modelJson, dsInfo, queryContext)
			So(err, ShouldBeNil)

			So(query.UseRawQuery, ShouldBeTrue)
			So(query.RawQuery, ShouldEqual, "raw-query")
			So(query.AddAppToAlias, ShouldBeTrue)
			So(query.AddHostToAlias, ShouldBeTrue)
		})
	})
}
