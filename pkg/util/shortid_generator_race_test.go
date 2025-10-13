//go:build race
// +build race

package util

import (
	"sync"
	"testing"
)

// Run with "go test -race -run ^TestThreadSafe$ github.com/grafana/grafana/pkg/util"
func TestThreadSafe(t *testing.T) {
	// Use 1000 go routines to create 100 UIDs each at roughly the same time.
	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		go func() {
			for ii := 0; ii < 100; ii++ {
				_ = GenerateShortUID()
			}
			wg.Done()
		}()
		wg.Add(1)
	}
	wg.Wait()
}
