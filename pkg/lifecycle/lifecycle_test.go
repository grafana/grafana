package lifecycle

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestLifecycle(t *testing.T) {
	Convey("TestLifecycle", t, func() {
		Convey("Given listeners", func() {
			applicationStartingCounter := 0
			AddListener(ApplicationStarting, func() {
				applicationStartingCounter++
			})

			applicationStartedCounter := 0
			AddListener(ApplicationStarted, func() {
				applicationStartedCounter++
			})

			Convey("When notify application starting should call listener", func() {
				Notify(ApplicationStarting)
				So(applicationStartingCounter, ShouldEqual, 1)
				So(applicationStartedCounter, ShouldEqual, 0)
			})

			Convey("When notify application started should call listener", func() {
				Notify(ApplicationStarted)
				So(applicationStartingCounter, ShouldEqual, 0)
				So(applicationStartedCounter, ShouldEqual, 1)
			})
		})
	})
}
