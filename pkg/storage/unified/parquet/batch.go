package parquet

import (
	"context"
	"fmt"
	"os"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/zeebo/assert"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewBatchHandler() (resource.BatchProcessingBackend, error) {
	f, err := os.CreateTemp(".", "grafana-batch-export-*.parquet")
	if err != nil {
		return nil, err
	}
	return &batchHandler{
		file: f,
	}, nil
}

type batchHandler struct {
	file *os.File
}

func (s *batchHandler) ProcessBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) *resource.BatchResponse {
	rsp := &resource.BatchResponse{}

	writer, err := NewResourceWriter(s.file)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	for iter.Next() {
		if iter.RollbackRequested() {
			fmt.Printf("Rollback requested %s\n", s.file.Name())
			break
		}

		// writer.WR
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
	fmt.Printf("DONE %s\n", s.file.Name())
	return rsp
}

type batchIter struct {
	fileReader     *file.Reader
	rowGroupReader *file.RowGroupReader

	rowGroupID int

	req *resource.BatchRequest

	namespace
}

func NewBatchIterator(path string) (resource.BatchRequestIterator, error) {
	props := parquet.NewReaderProperties(memory.DefaultAllocator)
	reader, err := file.OpenParquetFile(path, false, file.WithReadProps(props))
	if err != nil {
		return nil, err
	}
	iter := &batchIter{
		fileReader:     reader,
		rowGroupID:     0,
		rowGroupReader: reader.RowGroup(0),
	}
	return iter, nil
}

// Next implements resource.BatchRequestIterator.
func (b *batchIter) Next() bool {

	xxx, err := b.fileReader.RowGroup(1).GetColumnPageReader(1)

	p := xxx.Page()
	p.
		xxx.HasNext()
	b.rowGroupReader.C

	if b.rowGroupReader == nil {
		return false
	}

	columnReader, err := b.reader.RowGroup()(context.Background(), 0)
	assert.NoError(t, err)

	b.reader.
		require.NoError(t, err)
	defer fileReader.Close()

	panic("unimplemented")
}

// Request implements resource.BatchRequestIterator.
func (b *batchIter) Request() *resource.BatchRequest {
	panic("unimplemented")
}

// RollbackRequested implements resource.BatchRequestIterator.
func (b *batchIter) RollbackRequested() bool {
	panic("unimplemented")
}

var (
	_ resource.BatchRequestIterator = (*batchIter)(nil)
)
