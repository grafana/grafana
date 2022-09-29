package syncutil

import (
	"log"
	"runtime"
)

func worker(jobs chan func()) {
	for j := range jobs {
		j()
	}
}

// WorkerPool represents a concurrent worker pool.
type WorkerPool struct {
	NumWorkers int
	jobs       chan func()
}

// NewWorkerPool constructs a new WorkerPool.
func NewWorkerPool(numWorkers int) WorkerPool {
	if numWorkers <= 0 {
		numWorkers = runtime.NumCPU()
	}
	log.Printf("Creating worker pool with %d workers", numWorkers)
	jobs := make(chan func(), 100)
	for i := 0; i < numWorkers; i++ {
		go worker(jobs)
	}
	return WorkerPool{
		NumWorkers: numWorkers,
		jobs:       jobs,
	}
}

// Schedule schedules a job to be executed by a worker in the pool.
func (p WorkerPool) Schedule(job func()) {
	p.jobs <- job
}

func (p WorkerPool) Close() {
	close(p.jobs)
}
