package polling

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestTryLocker(t *testing.T) {

	Convey("Lock/Unlock", t, func() {
		locker := NewLocker()
		sync := make(chan int)
		go func() {
			locker.Lock()
			sync <- 1
			time.Sleep(time.Second)
			locker.Unlock()
		}()
		<-sync
		start := time.Now()
		locker.Lock()
		now := time.Now()
		So(now.Sub(start), ShouldBeGreaterThanOrEqualTo, time.Second)
		locker.Unlock()
	})

	Convey("TryLock/Unlock", t, func() {
		locker := NewLocker()
		sync := make(chan int)
		go func() {
			locker.Lock()
			sync <- 1
			time.Sleep(time.Second)
			locker.Unlock()
		}()
		<-sync
		ok := locker.TryLock()
		So(ok, ShouldBeFalse)
		time.Sleep(time.Second * 3 / 2)
		ok = locker.TryLock()
		So(ok, ShouldBeTrue)
		locker.Unlock()
	})

}
