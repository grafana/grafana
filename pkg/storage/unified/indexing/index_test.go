package indexing

import "testing"

func TestPerformanceInMemory(t *testing.T) {
	opts := Opts{
		inMemory: true,
	}
	run(opts)
}

func TestPerformanceFile(t *testing.T) {
	opts := Opts{}
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
		size: 100000,
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
		workers:    50,
		batchSize:  100,
		concurrent: true,
		size:       100000,
	}
	run(opts)
}

func TestPerformanceFileConcurrentLargeIndeMoreWorkersBiggerBatch(t *testing.T) {
	opts := Opts{
		workers:    1000,
		batchSize:  1000,
		concurrent: true,
		size:       100000,
	}
	run(opts)
}
