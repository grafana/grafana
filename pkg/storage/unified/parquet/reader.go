// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package parquet

import (
	"fmt"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.BatchRequestIterator = (*resourceReader)(nil)
)

type columBuffer interface {
	open(rgr *file.RowGroupReader) error
	batch(batchSize int64, defLevels []int16, repLevels []int16) error
}

type stringColumn struct {
	index  int // within the schemna
	reader *file.ByteArrayColumnChunkReader
	buffer []parquet.ByteArray
	count  int // the active count
}

func (c *stringColumn) open(rgr *file.RowGroupReader) error {
	tmp, err := rgr.Column(c.index)
	if err != nil {
		return err
	}
	ok := true
	c.reader, ok = tmp.(*file.ByteArrayColumnChunkReader)
	if !ok {
		return fmt.Errorf("expected resource strings")
	}
	return nil
}

func (c *stringColumn) batch(batchSize int64, defLevels []int16, repLevels []int16) error {
	_, count, err := c.reader.ReadBatch(batchSize, c.buffer, defLevels, repLevels)
	c.count = count
	return err
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
	ok := true
	c.reader, ok = tmp.(*file.Int32ColumnChunkReader)
	if !ok {
		return fmt.Errorf("expected resource strings")
	}
	return nil
}

func (c *int32Column) batch(batchSize int64, defLevels []int16, repLevels []int16) error {
	_, count, err := c.reader.ReadBatch(batchSize, c.buffer, defLevels, repLevels)
	c.count = count
	return err
}

type resourceReader struct {
	reader *file.Reader

	namespace *stringColumn
	group     *stringColumn
	resource  *stringColumn
	name      *stringColumn
	value     *stringColumn
	folder    *stringColumn
	action    *int32Column
	columns   []columBuffer

	batchSize int64

	defLevels []int16
	repLevels []int16

	// how many we already read
	bufferSize  int
	bufferIndex int
	rowGroupIDX int

	req *resource.BatchRequest
	err error
}

// Next implements resource.BatchRequestIterator.
func (r *resourceReader) Next() bool {
	r.req = nil
	for r.err == nil && r.reader != nil {
		if r.bufferIndex >= r.bufferSize && r.value.reader.HasNext() {
			r.bufferIndex = 0
			r.err = r.ReadBatch()
			if r.err != nil {
				return false
			}
			r.bufferIndex = r.value.count
		}

		if r.bufferSize > r.bufferIndex {
			i := r.bufferIndex
			r.bufferIndex++

			r.req = &resource.BatchRequest{
				Key: &resource.ResourceKey{
					Group:     r.group.buffer[i].String(),
					Resource:  r.resource.buffer[i].String(),
					Namespace: r.namespace.buffer[i].String(),
					Name:      r.name.buffer[i].String(),
				},
				Action: resource.BatchRequest_Action(r.action.buffer[i]),
				Value:  r.value.buffer[i].Bytes(),
				Folder: r.folder.buffer[i].String(),
			}

			return true
		}

		r.rowGroupIDX++
		if r.rowGroupIDX > r.reader.NumRowGroups() {
			_ = r.reader.Close()
			r.reader = nil
			return false
		}
		r.err = r.open(r.reader.RowGroup(r.rowGroupIDX))
	}

	return false
}

// Request implements resource.BatchRequestIterator.
func (r *resourceReader) Request() *resource.BatchRequest {
	return r.req
}

// RollbackRequested implements resource.BatchRequestIterator.
func (r *resourceReader) RollbackRequested() bool {
	return r.err != nil
}

func newResourceReader(inputPath string, batchSize int64) (*resourceReader, error) {
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

	reader := &resourceReader{
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

	reader.columns = []columBuffer{
		reader.namespace,
		reader.group,
		reader.resource,
		reader.name,
		reader.action,
		reader.value,
	}

	err = reader.open(rdr.RowGroup(0))
	if err != nil {
		_ = rdr.Close()
		return nil, err
	}

	// get the first batch
	err = reader.ReadBatch()
	if err != nil {
		_ = rdr.Close()
		return nil, err
	}

	return reader, nil
}

func (r *resourceReader) open(rgr *file.RowGroupReader) error {
	for _, c := range r.columns {
		err := c.open(rgr)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *resourceReader) ReadBatch() error {
	for _, c := range r.columns {
		err := c.batch(r.batchSize, r.defLevels, r.repLevels)
		if err != nil {
			return err
		}
	}
	return nil
}
