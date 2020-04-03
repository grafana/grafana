package pluginproxy

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
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

		bus.AddHandler("test", func(query *models.GetPluginSettingByIdQuery) error {
			key, err := util.Encrypt([]byte("123"), "password")
			if err != nil {
				return err
			}

			query.Result = &models.PluginSetting{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: true},
			nil,
		)

		Convey("Should add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "test_user")
		})
	})

	Convey("When SendUserHeader config is disabled", t, func() {
		req := getPluginProxiedRequest(
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: false},
			nil,
		)
		Convey("Should not add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "")
		})
	})

	Convey("When SendUserHeader config is enabled but user is anonymous", t, func() {
		req := getPluginProxiedRequest(
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{IsAnonymous: true},
			},
			&setting.Cfg{SendUserHeader: true},
			nil,
		)

		Convey("Should not add header with username", func() {
			// Get will return empty string even if header is not set
			So(req.Header.Get("X-Grafana-User"), ShouldEqual, "")
		})
	})

	Convey("When getting templated url", t, func() {
		route := &plugins.AppPluginRoute{
			Url:    "{{.JsonData.dynamicUrl}}",
			Method: "GET",
		}

		bus.AddHandler("test", func(query *models.GetPluginSettingByIdQuery) error {
			query.Result = &models.PluginSetting{
				JsonData: map[string]interface{}{
					"dynamicUrl": "https://dynamic.grafana.com",
				},
			}
			return nil
		})

		req := getPluginProxiedRequest(
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		Convey("Headers should be updated", func() {
			header, err := getHeaders(route, 1, "my-app")
			So(err, ShouldBeNil)
			So(header.Get("X-Grafana-User"), ShouldEqual, "")
		})
		Convey("Should set req.URL to be interpolated value from jsonData", func() {
			So(req.URL.String(), ShouldEqual, "https://dynamic.grafana.com")
		})
		Convey("Route url should not be modified", func() {
			So(route.Url, ShouldEqual, "{{.JsonData.dynamicUrl}}")
		})
	})

}

// getPluginProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getPluginProxiedRequest(ctx *models.ReqContext, cfg *setting.Cfg, route *plugins.AppPluginRoute) *http.Request {
	// insert dummy route if none is specified
	if route == nil {
		route = &plugins.AppPluginRoute{
			Path:    "api/v4/",
			Url:     "https://www.google.com",
			ReqRole: models.ROLE_EDITOR,
		}
	}
	proxy := NewApiPluginProxy(ctx, "", route, "", cfg)

	req, err := http.NewRequest(http.MethodGet, route.Url, nil)
	So(err, ShouldBeNil)
	proxy.Director(req)
	return req
}
