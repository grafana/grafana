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
	"encoding/binary"
	"fmt"
	"reflect"
	"time"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

const defaultBatchSize = 128

type Dumper struct {
	reader         file.ColumnChunkReader
	batchSize      int64
	valueOffset    int
	valuesBuffered int

	levelOffset    int64
	levelsBuffered int64
	defLevels      []int16
	repLevels      []int16

	valueBuffer interface{}
}

func createDumper(reader file.ColumnChunkReader) *Dumper {
	batchSize := defaultBatchSize

	var valueBuffer interface{}
	switch reader.(type) {
	case *file.BooleanColumnChunkReader:
		valueBuffer = make([]bool, batchSize)
	case *file.Int32ColumnChunkReader:
		valueBuffer = make([]int32, batchSize)
	case *file.Int64ColumnChunkReader:
		valueBuffer = make([]int64, batchSize)
	case *file.Float32ColumnChunkReader:
		valueBuffer = make([]float32, batchSize)
	case *file.Float64ColumnChunkReader:
		valueBuffer = make([]float64, batchSize)
	case *file.Int96ColumnChunkReader:
		valueBuffer = make([]parquet.Int96, batchSize)
	case *file.ByteArrayColumnChunkReader:
		valueBuffer = make([]parquet.ByteArray, batchSize)
	case *file.FixedLenByteArrayColumnChunkReader:
		valueBuffer = make([]parquet.FixedLenByteArray, batchSize)
	}

	return &Dumper{
		reader:      reader,
		batchSize:   int64(batchSize),
		defLevels:   make([]int16, batchSize),
		repLevels:   make([]int16, batchSize),
		valueBuffer: valueBuffer,
	}
}

func (dump *Dumper) readNextBatch() {
	switch reader := dump.reader.(type) {
	case *file.BooleanColumnChunkReader:
		values := dump.valueBuffer.([]bool)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.Int32ColumnChunkReader:
		values := dump.valueBuffer.([]int32)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.Int64ColumnChunkReader:
		values := dump.valueBuffer.([]int64)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.Float32ColumnChunkReader:
		values := dump.valueBuffer.([]float32)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.Float64ColumnChunkReader:
		values := dump.valueBuffer.([]float64)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.Int96ColumnChunkReader:
		values := dump.valueBuffer.([]parquet.Int96)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.ByteArrayColumnChunkReader:
		values := dump.valueBuffer.([]parquet.ByteArray)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	case *file.FixedLenByteArrayColumnChunkReader:
		values := dump.valueBuffer.([]parquet.FixedLenByteArray)
		dump.levelsBuffered, dump.valuesBuffered, _ = reader.ReadBatch(dump.batchSize, values, dump.defLevels, dump.repLevels)
	}

	dump.valueOffset = 0
	dump.levelOffset = 0
}

func (dump *Dumper) hasNext() bool {
	return dump.levelOffset < dump.levelsBuffered || dump.reader.HasNext()
}

const microSecondsPerDay = 24 * 3600e6

var parseInt96AsTimestamp = false

func (dump *Dumper) FormatValue(val interface{}, width int) string {
	fmtstring := fmt.Sprintf("-%d", width)
	switch val := val.(type) {
	case nil:
		return fmt.Sprintf("%"+fmtstring+"s", "NULL")
	case bool:
		return fmt.Sprintf("%"+fmtstring+"t", val)
	case int32:
		return fmt.Sprintf("%"+fmtstring+"d", val)
	case int64:
		return fmt.Sprintf("%"+fmtstring+"d", val)
	case float32:
		return fmt.Sprintf("%"+fmtstring+"f", val)
	case float64:
		return fmt.Sprintf("%"+fmtstring+"f", val)
	case parquet.Int96:
		if parseInt96AsTimestamp {
			usec := int64(binary.LittleEndian.Uint64(val[:8])/1000) +
				(int64(binary.LittleEndian.Uint32(val[8:]))-2440588)*microSecondsPerDay
			t := time.Unix(usec/1e6, (usec%1e6)*1e3).UTC()
			return fmt.Sprintf("%"+fmtstring+"s", t)
		} else {
			return fmt.Sprintf("%"+fmtstring+"s",
				fmt.Sprintf("%d %d %d",
					binary.LittleEndian.Uint32(val[:4]),
					binary.LittleEndian.Uint32(val[4:]),
					binary.LittleEndian.Uint32(val[8:])))
		}
	case parquet.ByteArray:
		if dump.reader.Descriptor().ConvertedType() == schema.ConvertedTypes.UTF8 {
			return fmt.Sprintf("%"+fmtstring+"s", string(val))
		}
		return fmt.Sprintf("% "+fmtstring+"X", val)
	case parquet.FixedLenByteArray:
		return fmt.Sprintf("% "+fmtstring+"X", val)
	default:
		return fmt.Sprintf("%"+fmtstring+"s", fmt.Sprintf("%v", val))
	}
}

func (dump *Dumper) Next() (interface{}, bool) {
	if dump.levelOffset == dump.levelsBuffered {
		if !dump.hasNext() {
			return nil, false
		}
		dump.readNextBatch()
		if dump.levelsBuffered == 0 {
			return nil, false
		}
	}

	defLevel := dump.defLevels[int(dump.levelOffset)]
	// repLevel := dump.repLevels[int(dump.levelOffset)]
	dump.levelOffset++

	if defLevel < dump.reader.Descriptor().MaxDefinitionLevel() {
		return nil, true
	}

	vb := reflect.ValueOf(dump.valueBuffer)
	v := vb.Index(dump.valueOffset).Interface()
	dump.valueOffset++

	return v, true
}
