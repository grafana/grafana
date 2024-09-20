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

func TestPerformanceFileLargeIndex(t *testing.T) {
	opts := Opts{
		workers:   10,
		batchSize: 1000,
		size:      100000,
	}
	run(opts)
}

func TestPerformanceFileConcurrentLargeIndex(t *testing.T) {
	opts := Opts{
		workers:    10,
		batchSize:  1000,
		concurrent: true,
		size:       100000,
	}
	run(opts)
}

func TestPerformanceFileConcurrentLargeIndeMoreWorkers(t *testing.T) {
	opts := Opts{
		workers:    100,
		batchSize:  1000,
		concurrent: true,
		size:       100000,
	}
	run(opts)
}
