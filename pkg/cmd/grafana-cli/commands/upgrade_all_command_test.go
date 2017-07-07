package commands

import (
	"testing"

	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestVersionComparsion(t *testing.T) {
	Convey("Validate that version is outdated", t, func() {
		versions := []m.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		shouldUpgrade := map[string]m.Plugin{
			"0.0.0": {Versions: versions},
			"1.0.0": {Versions: versions},
		}

		Convey("should return error", func() {
			for k, v := range shouldUpgrade {
				So(ShouldUpgrade(k, v), ShouldBeTrue)
			}
		})
	})

	Convey("Validate that version is ok", t, func() {
		versions := []m.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		shouldNotUpgrade := map[string]m.Plugin{
			"2.0.0": {Versions: versions},
			"6.0.0": {Versions: versions},
		}

		Convey("should return error", func() {
			for k, v := range shouldNotUpgrade {
				So(ShouldUpgrade(k, v), ShouldBeFalse)
			}
		})
	})
}
