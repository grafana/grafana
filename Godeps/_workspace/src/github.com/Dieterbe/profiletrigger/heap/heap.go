package heap

import (
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"time"
)

// Heap will check every checkEvery for memory used (allocated minus free) to reach or exceed the threshold and take a memory profile to the path directory,
// but no more often than every minTimeDiff seconds
// any errors will be sent to the errors channel
type Heap struct {
	path        string
	threshold   int
	minTimeDiff int
	checkEvery  time.Duration
	lastUnix    int64
	Errors      chan error
}

// New creates a new Heap trigger. use a nil channel if you don't care about any errors
func New(path string, threshold, minTimeDiff int, checkEvery time.Duration, errors chan error) (*Heap, error) {
	heap := Heap{
		path,
		threshold,
		minTimeDiff,
		checkEvery,
		int64(0),
		errors,
	}
	return &heap, nil
}

func (heap Heap) logError(err error) {
	if heap.Errors != nil {
		heap.Errors <- err
	}
}

func (heap Heap) Run() {
	tick := time.NewTicker(heap.checkEvery)
	m := &runtime.MemStats{}
	for ts := range tick.C {
		runtime.ReadMemStats(m)
		unix := ts.Unix()
		if m.Alloc >= uint64(heap.threshold) && unix >= heap.lastUnix+int64(heap.minTimeDiff) {
			f, err := os.Create(fmt.Sprintf("%s/%d.profile-heap", heap.path, unix))
			if err != nil {
				heap.logError(err)
				continue
			}
			err = pprof.WriteHeapProfile(f)
			if err != nil {
				heap.logError(err)
			}
			err = f.Close()
			if err != nil {
				heap.logError(err)
			}
			heap.lastUnix = unix
		}
	}
}
