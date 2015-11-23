package engineio

import (
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestServerSessions(t *testing.T) {
	Convey("Server sessions", t, func() {
		sessions := newServerSessions()

		So(sessions.Get("a"), ShouldBeNil)

		sessions.Set("b", new(serverConn))
		So(sessions.Get("b"), ShouldNotBeNil)

		So(sessions.Get("a"), ShouldBeNil)

		sessions.Set("c", new(serverConn))
		So(sessions.Get("c"), ShouldNotBeNil)

		sessions.Remove("b")
		So(sessions.Get("b"), ShouldBeNil)
	})
}
