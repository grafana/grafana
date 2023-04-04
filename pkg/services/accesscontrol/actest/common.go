package actest

import "sync"

const Concurrency = 10
const BatchSize = 1000

type bounds struct {
	start, end int
}

// ConcurrentBatch spawns the requested amount of workers then ask them to run eachFn on chunks of the requested size
func ConcurrentBatch(workers, count, size int, eachFn func(start, end int) error) error {
	var wg sync.WaitGroup
	alldone := make(chan bool) // Indicates that all workers have finished working
	chunk := make(chan bounds) // Gives the workers the bounds they should work with
	ret := make(chan error)    // Allow workers to notify in case of errors
	defer close(ret)

	// Launch all workers
	for x := 0; x < workers; x++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ck := range chunk {
				if err := eachFn(ck.start, ck.end); err != nil {
					ret <- err
					return
				}
			}
		}()
	}

	go func() {
		// Tell the workers the chunks they have to work on
		for i := 0; i < count; {
			end := i + size
			if end > count {
				end = count
			}

			chunk <- bounds{start: i, end: end}

			i = end
		}
		close(chunk)

		// Wait for the workers
		wg.Wait()
		close(alldone)
	}()

	// wait for an error or for all workers to be done
	select {
	case err := <-ret:
		return err
	case <-alldone:
		break
	}
	return nil
}
