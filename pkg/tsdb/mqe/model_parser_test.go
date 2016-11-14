package mqe

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMQEQueryParser(t *testing.T) {
	Convey("MQE query parser", t, func() {
		parser := &MQEQueryParser{}

		dsInfo := &tsdb.DataSourceInfo{
			JsonData: simplejson.New(),
		}

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

			query, err := parser.Parse(modelJson, dsInfo)
			So(err, ShouldBeNil)

			rawQuery := query.Build(queryContext)
			So(rawQuery, ShouldEqual, "")
		})

		Convey("can parse multi serie mqe model", func() {
			json := `
      {
        "apps": [],
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

			So(json, ShouldNotBeNil)
		})
	})
}
