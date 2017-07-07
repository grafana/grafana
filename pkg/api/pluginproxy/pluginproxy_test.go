package pluginproxy

import (
	"testing"

	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/plugins"
	"github.com/wangy1931/grafana/pkg/setting"
	"github.com/wangy1931/grafana/pkg/util"
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
			query.Result = &m.PluginSetting{
				SecureJsonData: map[string][]byte{
					"key": util.Encrypt([]byte("123"), "password"),
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

}
