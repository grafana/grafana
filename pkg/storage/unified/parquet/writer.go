package parquet

import (
	"context"
	"io"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/compress"
	"github.com/apache/arrow-go/v18/parquet/pqarrow"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.BulkResourceWriter = (*parquetWriter)(nil)
)

// Write resources into a parquet file
func NewParquetWriter(f io.Writer) (*parquetWriter, error) {
	w := &parquetWriter{
		pool:    memory.DefaultAllocator,
		schema:  newSchema(nil),
		buffer:  1024 * 10 * 100 * 10, // 10MB
		logger:  logging.DefaultLogger.With("logger", "parquet.writer"),
		rsp:     &resourcepb.BulkResponse{},
		summary: make(map[string]*resourcepb.BulkResponse_Summary),
	}

	props := parquet.NewWriterProperties(
		parquet.WithCompression(compress.Codecs.Brotli),
	)
	writer, err := pqarrow.NewFileWriter(w.schema, f, props, pqarrow.DefaultWriterProps())
	if err != nil {
		return nil, err
	}
	w.writer = writer
	return w, w.init()
}

// ProcessBulk implements resource.BulkProcessingBackend.
func (w *parquetWriter) ProcessBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	defer func() { _ = w.Close() }()

	var err error
	for iter.Next() {
		if iter.RollbackRequested() {
			break
		}

		req := iter.Request()

		err = w.Write(ctx, req.Key, req.Value)
		if err != nil {
			break
		}
	}

	rsp, err := w.CloseWithResults()
	if err != nil {
		w.logger.Warn("error closing parquet file", "err", err)
	}
	if rsp == nil {
		rsp = &resourcepb.BulkResponse{}
	}
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}

type parquetWriter struct {
	pool   memory.Allocator
	buffer int
	wrote  int

	schema *arrow.Schema
	writer *pqarrow.FileWriter
	logger logging.Logger

	rv        *array.Int64Builder
	namespace *array.StringBuilder
	group     *array.StringBuilder
	resource  *array.StringBuilder
	name      *array.StringBuilder
	folder    *array.StringBuilder
	action    *array.Int8Builder
	value     *array.StringBuilder

	rsp     *resourcepb.BulkResponse
	summary map[string]*resourcepb.BulkResponse_Summary
}

func (w *parquetWriter) CloseWithResults() (*resourcepb.BulkResponse, error) {
	err := w.Close()
	return w.rsp, err
}

func (w *parquetWriter) Close() error {
	if w.rv.Len() > 0 {
		_ = w.flush()
	}
	w.logger.Info("close")
	return w.writer.Close()
}

// writes the current buffer to parquet and re-inits the arrow buffer
func (w *parquetWriter) flush() error {
	w.logger.Info("flush", "count", w.rv.Len())
	rec := array.NewRecord(w.schema, []arrow.Array{
		w.rv.NewArray(),
		w.namespace.NewArray(),
		w.group.NewArray(),
		w.resource.NewArray(),
		w.name.NewArray(),
		w.folder.NewArray(),
		w.action.NewArray(),
		w.value.NewArray(),
	}, int64(w.rv.Len()))
	defer rec.Release()
	err := w.writer.Write(rec)
	if err != nil {
		return err
	}
	return w.init()
}

func (w *parquetWriter) init() error {
	w.rv = array.NewInt64Builder(w.pool)
	w.namespace = array.NewStringBuilder(w.pool)
	w.group = array.NewStringBuilder(w.pool)
	w.resource = array.NewStringBuilder(w.pool)
	w.name = array.NewStringBuilder(w.pool)
	w.folder = array.NewStringBuilder(w.pool)
	w.action = array.NewInt8Builder(w.pool)
	w.value = array.NewStringBuilder(w.pool)
	w.wrote = 0
	return nil
}

func (w *parquetWriter) Write(ctx context.Context, key *resourcepb.ResourceKey, value []byte) error {
	w.rsp.Processed++
	obj := &unstructured.Unstructured{}
	err := obj.UnmarshalJSON(value)
	if err != nil {
		return err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	rv, _ := meta.GetResourceVersionInt64() // it can be empty

	w.rv.Append(rv)
	w.namespace.Append(key.Namespace)
	w.group.Append(key.Group)
	w.resource.Append(key.Resource)
	w.name.Append(key.Name)
	w.folder.Append(meta.GetFolder())
	w.value.Append(string(value))

	var action resourcepb.WatchEvent_Type
	switch meta.GetGeneration() {
	case 0, 1:
		action = resourcepb.WatchEvent_ADDED
	case utils.DeletedGeneration:
		action = resourcepb.WatchEvent_DELETED
	default:
		action = resourcepb.WatchEvent_MODIFIED
	}
	w.action.Append(int8(action))

	w.wrote = w.wrote + len(value)
	if w.wrote > w.buffer {
		w.logger.Info("buffer full", "buffer", w.wrote, "max", w.buffer)
		return w.flush()
	}

	summary := w.summary[resource.NSGR(key)]
	if summary == nil {
		summary = &resourcepb.BulkResponse_Summary{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}
		w.summary[resource.NSGR(key)] = summary
		w.rsp.Summary = append(w.rsp.Summary, summary)
	}
	summary.Count++
	return nil
}

func newSchema(metadata *arrow.Metadata) *arrow.Schema {
	return arrow.NewSchema([]arrow.Field{
		{Name: "resource_version", Type: &arrow.Int64Type{}, Nullable: false},
		{Name: "group", Type: &arrow.StringType{}, Nullable: false},
		{Name: "resource", Type: &arrow.StringType{}, Nullable: false},
		{Name: "namespace", Type: &arrow.StringType{}, Nullable: false},
		{Name: "name", Type: &arrow.StringType{}, Nullable: false},
		{Name: "folder", Type: &arrow.StringType{}, Nullable: false},
		{Name: "action", Type: &arrow.Int8Type{}, Nullable: false}, // 1,2,3
		{Name: "value", Type: &arrow.StringType{}, Nullable: false},
	}, metadata)
}
