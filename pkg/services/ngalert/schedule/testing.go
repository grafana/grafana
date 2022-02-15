package schedule

import (
	"testing"
	"time"
)

// waitForTimeChannel blocks the execution until either the channel ch has some data or a timeout of 10 second expires.
// Timeout will cause the test to fail.
// Returns the data from the channel.
func waitForTimeChannel(t *testing.T, ch chan time.Time) time.Time {
	select {
	case result := <-ch:
		return result
	case <-time.After(time.Duration(10) * time.Second):
		t.Fatalf("Timeout waiting for data in the time channel")
		return time.Time{}
	}
}

// waitForErrChannel blocks the execution until either the channel ch has some data or a timeout of 10 second expires.
// Timeout will cause the test to fail.
// Returns the data from the channel.
func waitForErrChannel(t *testing.T, ch chan error) error {
	timeout := time.Duration(10) * time.Second
	select {
	case result := <-ch:
		return result
	case <-time.After(timeout):
		t.Fatal("Timeout waiting for data in the error channel")
		return nil
	}
}
