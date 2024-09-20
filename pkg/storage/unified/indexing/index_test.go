package indexing

import "testing"

func TestPerformanceInMemory(t *testing.T) {
	opts := Opts{
		workers:   10,
		batchSize: 1000,
		inMemory:  true,
	}
	run(opts)
}

func TestPerformanceFile(t *testing.T) {
	opts := Opts{
		workers:   10,
		batchSize: 1000,
	}
	run(opts)
}

func TestPerformanceMemoryConcurrent(t *testing.T) {
	opts := Opts{
		workers:    10,
		batchSize:  1000,
		concurrent: true,
		inMemory:   true,
	}
	run(opts)
}

func TestPerformanceFileConcurrent(t *testing.T) {
	opts := Opts{
		workers:    10,
		batchSize:  1000,
		concurrent: true,
	}
	run(opts)
}
