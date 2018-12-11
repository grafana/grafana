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

	Convey("Server lock integration test", t, func() {

		Convey("Check that we can call OncePerServerGroup multiple times without executing callback", func() {
			counter := 0
			var err error

			//this time `fn` should be executed
			err = sl.OncePerServerGroup(context.Background(), "test-operation", time.Second*5, func() { counter++ })
			So(err, ShouldBeNil)

			//this should not execute `fn`
			err = sl.OncePerServerGroup(context.Background(), "test-operation", time.Second*5, func() { counter++ })
			So(err, ShouldBeNil)

			//this should not execute `fn`
			err = sl.OncePerServerGroup(context.Background(), "test-operation", time.Second*5, func() { counter++ })
			So(err, ShouldBeNil)

			// wg := sync.WaitGroup{}
			// for i := 0; i < 3; i++ {
			// 	wg.Add(1)
			// 	go func(index int) {
			// 		defer wg.Done()
			// 		//sl := createTestableServerLock(t)
			// 		//<-time.After(time.Second)

			// 		j := 0
			// 		for {
			// 			select {
			// 			case <-time.Tick(time.Second):
			// 				fmt.Printf("running worker %d loop %d\n", index, j)
			// 				err := sl.OncePerServerGroup(context.Background(), "test-operation", time.Second*2, func() {
			// 					counter++
			// 				})

			// 				if err != nil {
			// 					t.Errorf("expected. err: %v", err)
			// 				}

			// 				j++
			// 				if j > 3 {
			// 					return
			// 				}
			// 			}
			// 		}
			// 	}(i)
			// }

			// wg.Wait()

			// wait 5 second.
			<-time.After(time.Second * 10)

			// now `fn` should be executed again
			err = sl.OncePerServerGroup(context.Background(), "test-operation", time.Second*5, func() { counter++ })
			So(err, ShouldBeNil)
			So(counter, ShouldEqual, 2)
		})
	})
}
