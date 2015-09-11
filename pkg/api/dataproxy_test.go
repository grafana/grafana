package api

import (
	"net/http"
	"net/url"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestDataSourceProxy(t *testing.T) {

	Convey("When getting graphite datasource proxy", t, func() {
		ds := m.DataSource{Url: "htttp://graphite:8080", Type: m.DS_GRAPHITE}
		targetUrl, _ := url.Parse(ds.Url)
		proxy := NewReverseProxy(&ds, "/render", targetUrl)

		requestUrl, _ := url.Parse("http://grafana.com/sub")
		req := http.Request{URL: requestUrl}

		proxy.Director(&req)

		Convey("Can translate request url and path", func() {
			So(req.URL.Host, ShouldEqual, "graphite:8080")
			So(req.URL.Path, ShouldEqual, "/render")
		})
	})

	Convey("When getting influxdb datasource proxy", t, func() {
		ds := m.DataSource{
			Type:     m.DS_INFLUXDB_08,
			Url:      "http://influxdb:8083",
			Database: "site",
			User:     "user",
			Password: "password",
		}

		targetUrl, _ := url.Parse(ds.Url)
		proxy := NewReverseProxy(&ds, "", targetUrl)

		requestUrl, _ := url.Parse("http://grafana.com/sub")
		req := http.Request{URL: requestUrl}

		proxy.Director(&req)

		Convey("Should add db to url", func() {
			So(req.URL.Path, ShouldEqual, "/db/site/")
		})

		Convey("Should add username and password", func() {
			queryVals := req.URL.Query()
			So(queryVals["u"][0], ShouldEqual, "user")
			So(queryVals["p"][0], ShouldEqual, "password")
		})

	})

}
