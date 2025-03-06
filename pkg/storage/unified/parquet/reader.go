package parquet

import (
	"fmt"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.BulkRequestIterator = (*parquetReader)(nil)
)

func NewParquetReader(inputPath string, batchSize int64) (resource.BulkRequestIterator, error) {
	return newResourceReader(inputPath, batchSize)
}

type parquetReader struct {
	reader *file.Reader

	namespace *stringColumn
	group     *stringColumn
	resource  *stringColumn
	name      *stringColumn
	value     *stringColumn
	folder    *stringColumn
	action    *int32Column
	columns   []columnBuffer

	batchSize int64

	defLevels []int16
	repLevels []int16

	// how many we already read
	bufferSize  int
	bufferIndex int
	rowGroupIDX int

	req *resource.BulkRequest
	err error
}

// Next implements resource.BulkRequestIterator.
func (r *parquetReader) Next() bool {
	r.req = nil
	for r.err == nil && r.reader != nil {
		if r.bufferIndex >= r.bufferSize && r.value.reader.HasNext() {
			r.bufferIndex = 0
			r.err = r.readBulk()
			if r.err != nil {
				return false
			}
			r.bufferIndex = r.value.count
		}

		if r.bufferSize > r.bufferIndex {
			i := r.bufferIndex
			r.bufferIndex++

			r.req = &resource.BulkRequest{
				Key: &resource.ResourceKey{
					Group:     r.group.buffer[i].String(),
					Resource:  r.resource.buffer[i].String(),
					Namespace: r.namespace.buffer[i].String(),
					Name:      r.name.buffer[i].String(),
				},
				Action: resource.BulkRequest_Action(r.action.buffer[i]),
				Value:  r.value.buffer[i].Bytes(),
				Folder: r.folder.buffer[i].String(),
			}

			return true
		}

		r.rowGroupIDX++
		if r.rowGroupIDX >= r.reader.NumRowGroups() {
			_ = r.reader.Close()
			r.reader = nil
			return false
		}
		r.err = r.open(r.reader.RowGroup(r.rowGroupIDX))
	}

	return false
}

// Request implements resource.BulkRequestIterator.
func (r *parquetReader) Request() *resource.BulkRequest {
	return r.req
}

// RollbackRequested implements resource.BulkRequestIterator.
func (r *parquetReader) RollbackRequested() bool {
	return r.err != nil
}

func newResourceReader(inputPath string, batchSize int64) (*parquetReader, error) {
	rdr, err := file.OpenParquetFile(inputPath, true)
	if err != nil {
		return nil, err
	}

	schema := rdr.MetaData().Schema
	makeColumn := func(name string) *stringColumn {
		index := schema.ColumnIndexByName(name)
		if index < 0 {
			err = fmt.Errorf("missing column: %s", name)
		}
		return &stringColumn{
			index:  index,
			buffer: make([]parquet.ByteArray, batchSize),
		}
	}

	reader := &parquetReader{
		reader: rdr,

		namespace: makeColumn("namespace"),
		group:     makeColumn("group"),
		resource:  makeColumn("resource"),
		name:      makeColumn("name"),
		value:     makeColumn("value"),
		folder:    makeColumn("folder"),

		action: &int32Column{
			index:  schema.ColumnIndexByName("action"),
			buffer: make([]int32, batchSize),
		},

		batchSize: batchSize,
		defLevels: make([]int16, batchSize),
		repLevels: make([]int16, batchSize),
	}

	if err != nil {
		_ = rdr.Close()
		return nil, err
	}

	reader.columns = []columnBuffer{
		reader.namespace,
		reader.group,
		reader.resource,
		reader.name,
		reader.action,
		reader.value,
	}

	// Empty file, close and return
	if rdr.NumRowGroups() < 1 {
		err = rdr.Close()
		reader.reader = nil
		return reader, err
	}

	err = reader.open(rdr.RowGroup(0))
	if err != nil {
		_ = rdr.Close()
		return nil, err
	}

	// get the first batch
	err = reader.readBulk()
	if err != nil {
		_ = rdr.Close()
		return nil, err
	}

	return reader, nil
}

func (r *parquetReader) open(rgr *file.RowGroupReader) error {
	for _, c := range r.columns {
		err := c.open(rgr)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *parquetReader) readBulk() error {
	r.bufferIndex = 0
	r.bufferSize = 0
	for i, c := range r.columns {
		count, err := c.batch(r.batchSize, r.defLevels, r.repLevels)
		if err != nil {
			return err
		}
		if i > 0 && r.bufferSize != count {
			return fmt.Errorf("expecting the same size for all columns")
		}
		r.bufferSize = count
	}
	return nil
}

//-------------------------------
// Column support
//-------------------------------

type columnBuffer interface {
	open(rgr *file.RowGroupReader) error
	batch(batchSize int64, defLevels []int16, repLevels []int16) (int, error)
}

type stringColumn struct {
	index  int // within the schema
	reader *file.ByteArrayColumnChunkReader
	buffer []parquet.ByteArray
	count  int // the active count
}

func (c *stringColumn) open(rgr *file.RowGroupReader) error {
	tmp, err := rgr.Column(c.index)
	if err != nil {
		return err
	}
	var ok bool
	c.reader, ok = tmp.(*file.ByteArrayColumnChunkReader)
	if !ok {
		return fmt.Errorf("expected resource strings")
	}
	return nil
}

func (c *stringColumn) batch(batchSize int64, defLevels []int16, repLevels []int16) (int, error) {
	_, count, err := c.reader.ReadBatch(batchSize, c.buffer, defLevels, repLevels)
	c.count = count
	return count, err
}

type int32Column struct {
	index  int // within the schemna
	reader *file.Int32ColumnChunkReader
	buffer []int32
	count  int // the active count
}

func (c *int32Column) open(rgr *file.RowGroupReader) error {
	tmp, err := rgr.Column(c.index)
	if err != nil {
		return err
	}
	var ok bool
	c.reader, ok = tmp.(*file.Int32ColumnChunkReader)
	if !ok {
		return fmt.Errorf("expected resource strings")
	}
	return nil
}

func (c *int32Column) batch(batchSize int64, defLevels []int16, repLevels []int16) (int, error) {
	_, count, err := c.reader.ReadBatch(batchSize, c.buffer, defLevels, repLevels)
	c.count = count
	return count, err
}

//-------------------------------
// Column support
//-------------------------------
