package gou

import (
	"os"
	"time"
)

var (
	//finished chan bool
	lastTest time.Time = time.Now()
	stopper  func()    = func() {}
)

// Wait for condition (defined by func) to be true
// this is mostly for testing, but a utility to
// create a ticker checking back every 100 ms to see
// if something (the supplied check func) is done
//
//   WaitFor(func() bool {
//      return ctr.Ct == 0
//   },10)
// timeout (in seconds) is the last arg
func WaitFor(check func() bool, timeoutSecs int) {
	timer := time.NewTicker(100 * time.Millisecond)
	tryct := 0
	for _ = range timer.C {
		if check() {
			timer.Stop()
			break
		}
		if tryct >= timeoutSecs*10 {
			timer.Stop()
			break
		}
		tryct++
	}
}

// Use this in combo with StopCheck() for test functions that must start
// processes such as
func SetStopper(f func()) {
	stopper = f
}

// take two floats, compare, need to be within 2%
func CloseEnuf(a, b float64) bool {
	c := a / b
	if c > .98 && c < 1.02 {
		return true
	}
	return false
}

// take two ints, compare, need to be within 5%
func CloseInt(a, b int) bool {
	c := float64(a) / float64(b)
	if c >= .95 && c <= 1.05 {
		return true
	}
	return false
}

func StartTest() {
	lastTest = time.Now()
}

func StopCheck() {
	t := time.Now()
	if lastTest.Add(time.Millisecond*1000).UnixNano() < t.UnixNano() {
		Log(INFO, "Stopping Test ", lastTest.Unix())
		//finished <- true
		stopper()
		os.Exit(0)
	}
}
