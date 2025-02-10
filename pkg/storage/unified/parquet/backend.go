package parquet

import (
	"os"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type BatchWritingBackend interface {
	resource.StorageBackend
	resource.BatchProcessingBackend
}

func NewParquetBatchProcessingBackend(f *os.File) (BatchWritingBackend, error) {
	return resource.NewBatchWritingBackend(func(settings resource.BatchSettings) (resource.BatchResourceWriter, error) {
		return NewParquetWriter(f)
	}), nil
}
