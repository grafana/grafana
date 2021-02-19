package influxdb

import (
	"io/ioutil"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxDB(t *testing.T) {
	Convey("InfluxDB", t, func() {
		datasource := &models.DataSource{
			Url:      "http://awesome-influxdb:1337",
			Database: "awesome-db",
			JsonData: simplejson.New(),
		}
		query := "SELECT awesomeness FROM somewhere"
		e := &InfluxDBExecutor{
			QueryParser:    &InfluxdbQueryParser{},
			ResponseParser: &ResponseParser{},
		}
		Convey("createRequest with GET httpMode", func() {
			req, _ := e.createRequest(datasource, query)

			Convey("as default", func() {
				So(req.Method, ShouldEqual, "GET")
			})

			Convey("has a 'q' GET param that equals to query", func() {
				q := req.URL.Query().Get("q")
				So(q, ShouldEqual, query)
			})

			Convey("has an empty body", func() {
				So(req.Body, ShouldEqual, nil)
			})

		})

		Convey("createRequest with POST httpMode", func() {
			datasource.JsonData.Set("httpMode", "POST")
			req, _ := e.createRequest(datasource, query)

			Convey("method should be POST", func() {
				So(req.Method, ShouldEqual, "POST")
			})

			Convey("has no 'q' GET param", func() {
				q := req.URL.Query().Get("q")
				So(q, ShouldEqual, "")
			})

			Convey("has the request as GET param in body", func() {
				body, _ := ioutil.ReadAll(req.Body)
				testBodyValues := url.Values{}
				testBodyValues.Add("q", query)
				testBody := testBodyValues.Encode()
				So(string(body[:]), ShouldEqual, testBody)
			})

		})

		Convey("createRequest with PUT httpMode", func() {
			datasource.JsonData.Set("httpMode", "PUT")
			_, err := e.createRequest(datasource, query)

			Convey("should miserably fail", func() {
				So(err, ShouldEqual, ErrInvalidHttpMode)
			})

		})

	})
}
