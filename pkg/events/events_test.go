package events

import (
	"encoding/json"
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

		wire, _ := ToOnWriteEvent(e)
		So(e.Timestamp.Unix(), ShouldEqual, wire.Timestamp.Unix())
		So(wire.EventType, ShouldEqual, "TestEvent")

		json, _ := json.Marshal(wire)
		So(string(json), ShouldEqual, `{"event_type":"TestEvent","priority":"INFO","timestamp":"2009-01-08T14:25:23.000000223+01:00","payload":{"Timestamp":"2009-01-08T14:25:23.000000223+01:00"}}`)
	})

}
