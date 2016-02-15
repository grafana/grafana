package commands

import (
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMissingPath(t *testing.T) {
	Convey("Missing path", t, func() {
		commandLine := &commandstest.FakeCommandLine{
			CliArgs: []string{"ls"},
			GlobalFlags: &commandstest.FakeFlagger{
				Data: map[string]interface{}{
					"path": "",
				},
			},
		}
		s.IoHelper = &commandstest.FakeIoUtil{}

		Convey("should return error", func() {
			err := lsCommand(commandLine)
			So(err, ShouldNotBeNil)
		})
	})

	Convey("Path is not a directory", t, func() {
		commandLine := &commandstest.FakeCommandLine{
			CliArgs: []string{"ls"},
			GlobalFlags: &commandstest.FakeFlagger{
				Data: map[string]interface{}{
					"path": "/var/lib/grafana/plugins",
				},
			},
		}
		GetStat = &commandstest.FakeIoUtil{
			FakeIsDirectory: false,
		}

		Convey("should return error", func() {
			err := lsCommand(commandLine)
			So(err, ShouldNotBeNil)
		})
	})
}
