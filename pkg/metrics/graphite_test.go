package metrics

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestGraphitePublisher(t *testing.T) {

	Convey("Test graphite prefix", t, func() {
		err := setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../",
			Args: []string{
				"cfg:metrics.graphite.prefix=service.grafana.%instance_name%",
				"cfg:metrics.graphite.address=localhost:2003",
			},
		})
		So(err, ShouldBeNil)

		setting.InstanceName = "hostname.with.dots.com"
		publisher, err2 := CreateGraphitePublisher()

		So(err2, ShouldBeNil)
		So(publisher, ShouldNotBeNil)

		So(publisher.prefix, ShouldEqual, "service.grafana.hostname_with_dots_com")
	})
}
