package pluginproxy

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDSRouteRule(t *testing.T) {

	Convey("When applying ds route rule", t, func() {
		plugin := &plugins.DataSourcePlugin{
			Routes: []*plugins.AppPluginRoute{
				{
					Path: "api/v4/",
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

		Convey("When not matching route path", func() {
			ApplyDataSourceRouteRules(req, plugin, ds, "/asdas/asd")

			Convey("should not touch req", func() {
				So(len(req.Header), ShouldEqual, 0)
				So(req.URL.String(), ShouldEqual, "http://localhost/asd")
			})
		})

		Convey("When matching route path", func() {
			ApplyDataSourceRouteRules(req, plugin, ds, "api/v4/some/method")

			Convey("should add headers and update url", func() {
				So(req.URL.String(), ShouldEqual, "https://www.google.com/some/method")
				So(req.Header.Get("x-header"), ShouldEqual, "my secret 123")
			})
		})

	})

}
