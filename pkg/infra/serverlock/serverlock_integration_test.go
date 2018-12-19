// +build integration

package serverlock

import (
	"context"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestServerLok(t *testing.T) {
	sl := createTestableServerLock(t)

	Convey("Server lock integration tests", t, func() {
		counter := 0
		var err error
		incCounter := func() { counter++ }
		atInterval := time.Second * 1
		ctx := context.Background()

		//this time `fn` should be executed
		So(sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter), ShouldBeNil)

		//this should not execute `fn`
		So(sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter), ShouldBeNil)
		So(sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter), ShouldBeNil)
		So(sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter), ShouldBeNil)
		So(sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter), ShouldBeNil)

		// wait 5 second.
		<-time.After(atInterval * 2)

		// now `fn` should be executed again
		err = sl.LockAndExecute(ctx, "test-operation", atInterval, incCounter)
		So(err, ShouldBeNil)
		So(counter, ShouldEqual, 2)
	})
}
