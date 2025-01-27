package resource

import (
	"context"
	"fmt"
	"os"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/pqarrow"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type parquetSupport struct{}

func (s *parquetSupport) ProcessBatch(ctx context.Context, setting BatchSettings, iter BatchRequestIterator) *BatchResponse {
	f, err := os.CreateTemp(".", "grafana-batch-export-*.parquet")
	fmt.Printf("PROCESS!!! %s\n", f.Name())

	rsp := &BatchResponse{}
	schema := arrow.NewSchema([]arrow.Field{
		{Name: "name", Type: &arrow.StringType{}, Nullable: false},
		{Name: "rv", Type: &arrow.Int64Type{}, Nullable: false},
		{Name: "folder", Type: &arrow.StringType{}, Nullable: false},
		{Name: "value", Type: &arrow.StringType{}, Nullable: false},
	}, nil)

	builder := array.NewRecordBuilder(memory.DefaultAllocator, schema)
	defer builder.Release()

	props := parquet.NewWriterProperties()
	writer, err := pqarrow.NewFileWriter(schema, f, props, pqarrow.DefaultWriterProps())
	if err != nil {
		panic(err)
	}
	defer writer.Close()

	for iter.Next() {
		if iter.RollbackRequested() {
			fmt.Printf("Rollback requested %s\n", f.Name())
			break
		}

		// writer.WR
		req := iter.Request()
		obj := &unstructured.Unstructured{}
		err = obj.UnmarshalJSON(req.Value)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			break
		}
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			break
		}
		tmp, err := meta.GetResourceVersionInt64()
		if err != nil {
			rsp.Error = AsErrorResult(err)
			break
		}

		// one row at a time... not what parquet wants... but find for now
		pool := memory.DefaultAllocator
		name := array.NewStringBuilder(pool)
		rv := array.NewInt64Builder(pool)
		folder := array.NewStringBuilder(pool)
		value := array.NewStringBuilder(pool)

		name.Append(req.Key.Name)
		rv.Append(tmp)
		folder.Append(meta.GetFolder())
		value.Append(string(req.Value))

		rec := array.NewRecord(schema, []arrow.Array{
			name.NewArray(),
			rv.NewArray(),
			folder.NewArray(),
			value.NewArray(),
		}, 1)

		if err := writer.Write(rec); err != nil {
			panic(err)
		}
		rec.Release()
		fmt.Printf("wrote %s\n", req.Key.Name)
	}
	fmt.Printf("DONE %s\n", f.Name())
	return rsp
}
