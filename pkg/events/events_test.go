package events

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

type TestEvent struct {
	Timestamp time.Time
}

func TestEventCreation(t *testing.T) {

	Convey("Event to wire event", t, func() {
		e := TestEvent{
			Timestamp: time.Unix(1231421123, 223),
		}

		wire, _ := ToOnWriteEvent(&e)
		So(e.Timestamp.Unix(), ShouldEqual, wire.Timestamp.Unix())
		So(wire.EventType, ShouldEqual, "TestEvent")
	})

}
