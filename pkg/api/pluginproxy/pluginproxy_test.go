package pluginproxy

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPluginProxy(t *testing.T) {

	Convey("When getting proxy headers", t, func() {
		route := &plugins.AppPluginRoute{
			Headers: []plugins.AppPluginRouteHeader{
				{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
			},
		}

		setting.SecretKey = "password"

		bus.AddHandler("test", func(query *m.GetPluginSettingByIdQuery) error {
			key, err := util.Encrypt([]byte("123"), "password")
			if err != nil {
				return err
			}

			query.Result = &m.PluginSetting{
				SecureJsonData: map[string][]byte{
					"key": key,
				},
			}
			return nil
		})

		header, err := getHeaders(route, 1, "my-app")
		So(err, ShouldBeNil)

		Convey("Should render header template", func() {
			So(header.Get("x-header"), ShouldEqual, "my secret 123")
		})
	})

	Convey("When SendUserHeader config is enabled", t, func() {
		req := getPluginProxiedRequest(
			&m.ReqContext{
				SignedInUser: &m.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: true},
		)

		Convey("Should add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "test_user")
		})
	})

	Convey("When SendUserHeader config is disabled", t, func() {
		req := getPluginProxiedRequest(
			&m.ReqContext{
				SignedInUser: &m.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: false},
		)
		Convey("Should not add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "")
		})
	})

	Convey("When SendUserHeader config is enabled but user is anonymous", t, func() {
		req := getPluginProxiedRequest(
			&m.ReqContext{
				SignedInUser: &m.SignedInUser{IsAnonymous: true},
			},
			&setting.Cfg{SendUserHeader: true},
		)

		Convey("Should not add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "")
		})
	})
}

// getPluginProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getPluginProxiedRequest(ctx *m.ReqContext, cfg *setting.Cfg) *http.Request {
	route := &plugins.AppPluginRoute{}
	proxy := NewApiPluginProxy(ctx, "", route, "", cfg)

	req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
	So(err, ShouldBeNil)
	proxy.Director(req)
	return req
}
