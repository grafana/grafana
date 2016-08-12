package metrics

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestGraphitePublisher(t *testing.T) {

	Convey("Test graphite prefix replacement", t, func() {
		var err error
		err = setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../",
		})

		So(err, ShouldBeNil)

		sec, err := setting.Cfg.NewSection("metrics.graphite")
		sec.NewKey("prefix", "service.grafana.%(instance_name)s.")
		sec.NewKey("address", "localhost:2003")

		So(err, ShouldBeNil)

		setting.InstanceName = "hostname.with.dots.com"
		publisher, err := CreateGraphitePublisher()

		So(err, ShouldBeNil)
		So(publisher, ShouldNotBeNil)

		So(publisher.prefix, ShouldEqual, "service.grafana.hostname_with_dots_com.")
	})

	Convey("Test graphite publisher default values", t, func() {
		var err error
		err = setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../",
		})

		So(err, ShouldBeNil)

		_, err = setting.Cfg.NewSection("metrics.graphite")

		setting.InstanceName = "hostname.with.dots.com"
		publisher, err := CreateGraphitePublisher()

		So(err, ShouldBeNil)
		So(publisher, ShouldNotBeNil)

		So(publisher.prefix, ShouldEqual, "service.grafana.hostname_with_dots_com.")
		So(publisher.address, ShouldEqual, "localhost:2003")
	})
}
