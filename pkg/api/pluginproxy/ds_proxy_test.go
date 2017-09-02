package pluginproxy

import (
	"net/http"
	"net/url"
	"testing"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDSRouteRule(t *testing.T) {

	Convey("DataSourceProxy", t, func() {
		Convey("Plugin with routes", func() {
			plugin := &plugins.DataSourcePlugin{
				Routes: []*plugins.AppPluginRoute{
					{
						Path:    "api/v4/",
						Url:     "https://www.google.com",
						ReqRole: m.ROLE_EDITOR,
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
					{
						Path:    "api/admin",
						Url:     "https://www.google.com",
						ReqRole: m.ROLE_ADMIN,
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
					{
						Path: "api/anon",
						Url:  "https://www.google.com",
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
				},
			}

			setting.SecretKey = "password"
			key, _ := util.Encrypt([]byte("123"), "password")

			ds := &m.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"clientId": "asd",
				}),
				SecureJsonData: map[string][]byte{
					"key": key,
				},
			}

			req, _ := http.NewRequest("GET", "http://localhost/asd", nil)
			ctx := &middleware.Context{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR},
			}

			Convey("When matching route path", func() {
				proxy := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method")
				proxy.route = plugin.Routes[0]
				proxy.applyRoute(req)

				Convey("should add headers and update url", func() {
					So(req.URL.String(), ShouldEqual, "https://www.google.com/some/method")
					So(req.Header.Get("x-header"), ShouldEqual, "my secret 123")
				})
			})

			Convey("Validating request", func() {
				Convey("plugin route with valid role", func() {
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method")
					err := proxy.validateRequest()
					So(err, ShouldBeNil)
				})

				Convey("plugin route with admin role and user is editor", func() {
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/admin")
					err := proxy.validateRequest()
					So(err, ShouldNotBeNil)
				})

				Convey("plugin route with admin role and user is admin", func() {
					ctx.SignedInUser.OrgRole = m.ROLE_ADMIN
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/admin")
					err := proxy.validateRequest()
					So(err, ShouldBeNil)
				})
			})
		})

		Convey("When proxying graphite", func() {
			plugin := &plugins.DataSourcePlugin{}
			ds := &m.DataSource{Url: "htttp://graphite:8080", Type: m.DS_GRAPHITE}
			ctx := &middleware.Context{}

			proxy := NewDataSourceProxy(ds, plugin, ctx, "/render")

			requestUrl, _ := url.Parse("http://grafana.com/sub")
			req := http.Request{URL: requestUrl}

			proxy.getDirector()(&req)

			Convey("Can translate request url and path", func() {
				So(req.URL.Host, ShouldEqual, "graphite:8080")
				So(req.URL.Path, ShouldEqual, "/render")
			})
		})

		Convey("When proxying InfluxDB", func() {
			plugin := &plugins.DataSourcePlugin{}

			ds := &m.DataSource{
				Type:     m.DS_INFLUXDB_08,
				Url:      "http://influxdb:8083",
				Database: "site",
				User:     "user",
				Password: "password",
			}

			ctx := &middleware.Context{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "")

			requestUrl, _ := url.Parse("http://grafana.com/sub")
			req := http.Request{URL: requestUrl}

			proxy.getDirector()(&req)

			Convey("Should add db to url", func() {
				So(req.URL.Path, ShouldEqual, "/db/site/")
			})

			Convey("Should add username and password", func() {
				queryVals := req.URL.Query()
				So(queryVals["u"][0], ShouldEqual, "user")
				So(queryVals["p"][0], ShouldEqual, "password")
			})
		})

		Convey("When interpolating string", func() {
			data := templateData{
				SecureJsonData: map[string]string{
					"Test": "0asd+asd",
				},
			}

			interpolated, err := interpolateString("{{.SecureJsonData.Test}}", data)
			So(err, ShouldBeNil)
			So(interpolated, ShouldEqual, "0asd+asd")
		})

	})
}
