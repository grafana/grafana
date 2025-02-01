package parquet

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewBatchHandler(dir string) (resource.BatchProcessingBackend, string, error) {
	f, err := os.CreateTemp(dir, "grafana-batch-export-*.parquet")
	if err != nil {
		return nil, "", err
	}
	return &batchHandler{
		file: f,
	}, f.Name(), nil
}

type batchHandler struct {
	file *os.File
}

func (s *batchHandler) ProcessBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) *resource.BatchResponse {
	rsp := &resource.BatchResponse{}

	writer, err := NewParquetWriter(s.file)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	for iter.Next() {
		if iter.RollbackRequested() {
			fmt.Printf("Rollback requested %s\n", s.file.Name())
			break
		}

		req := iter.Request()

		err = writer.Add(ctx, req.Key, req.Value)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp
		}
	}

	err = writer.Close()
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}
