package fsql

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/scalar"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"google.golang.org/grpc/metadata"
)

// TODO: Make this configurable. This is an arbitrary value right
// now. Grafana used to have a 1M row rowLimit established in open-source. I'll
// let users hit that for now until we decide how to proceed.
const rowLimit = 1_000_000

type recordReader interface {
	Next() bool
	Schema() *arrow.Schema
	Record() arrow.Record
	Err() error
}

// newQueryDataResponse builds a [backend.DataResponse] from a stream of
// [arrow.Record]s.
//
// The backend.DataResponse contains a single [data.Frame].
func newQueryDataResponse(reader recordReader, query sqlutil.Query, headers metadata.MD) backend.DataResponse {
	var resp backend.DataResponse
	frame, err := frameForRecords(reader)
	if err != nil {
		resp.Error = err
	}
	if frame.Rows() == 0 {
		resp.Frames = data.Frames{}
		return resp
	}

	frame.Meta.Custom = map[string]any{
		"headers": headers,
	}
	frame.Meta.ExecutedQueryString = query.RawSQL
	frame.Meta.DataTopic = data.DataTopic(query.RawSQL)

	switch query.Format {
	case sqlutil.FormatOptionTimeSeries:
		if _, idx := frame.FieldByName("time"); idx == -1 {
			resp.Error = fmt.Errorf("no time column found")
			return resp
		}

		if frame.TimeSeriesSchema().Type == data.TimeSeriesTypeLong {
			var err error
			frame, err = data.LongToWide(frame, nil)
			if err != nil {
				resp.Error = err
				return resp
			}
		}
	case sqlutil.FormatOptionTable:
		// No changes to the output. Send it as is.
	case sqlutil.FormatOptionLogs:
		// TODO(brett): We need to find out what this actually is and if its
		// worth supporting. Pass through as "table" for now.
	default:
		resp.Error = fmt.Errorf("unsupported format")
	}

	resp.Frames = data.Frames{frame}
	return resp
}

// frameForRecords creates a [data.Frame] from a stream of [arrow.Record]s.
func frameForRecords(reader recordReader) (*data.Frame, error) {
	var (
		frame = newFrame(reader.Schema())
		rows  int64
	)
	for reader.Next() {
		record := reader.Record()
		for i, col := range record.Columns() {
			if err := copyData(frame.Fields[i], col); err != nil {
				return frame, err
			}
		}

		rows += record.NumRows()
		if rows > rowLimit {
			frame.AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     fmt.Sprintf("Results have been limited to %v because the SQL row limit was reached", rowLimit),
			})
			return frame, nil
		}

		if err := reader.Err(); err != nil && !errors.Is(err, io.EOF) {
			return frame, err
		}
	}
	return frame, nil
}

// newFrame builds a new Data Frame from an Arrow Schema.
func newFrame(schema *arrow.Schema) *data.Frame {
	fields := schema.Fields()
	df := &data.Frame{
		Fields: make([]*data.Field, len(fields)),
		Meta:   &data.FrameMeta{},
	}
	for i, f := range fields {
		df.Fields[i] = newField(f)
	}
	return df
}

func newField(f arrow.Field) *data.Field {
	switch f.Type.ID() {
	case arrow.STRING, arrow.STRING_VIEW:
		return newDataField[string](f)
	case arrow.FLOAT32:
		return newDataField[float32](f)
	case arrow.FLOAT64:
		return newDataField[float64](f)
	case arrow.UINT8:
		return newDataField[uint8](f)
	case arrow.UINT16:
		return newDataField[uint16](f)
	case arrow.UINT32:
		return newDataField[uint32](f)
	case arrow.UINT64:
		return newDataField[uint64](f)
	case arrow.INT8:
		return newDataField[int8](f)
	case arrow.INT16:
		return newDataField[int16](f)
	case arrow.INT32:
		return newDataField[int32](f)
	case arrow.INT64:
		return newDataField[int64](f)
	case arrow.BOOL:
		return newDataField[bool](f)
	case arrow.TIMESTAMP:
		return newDataField[time.Time](f)
	case arrow.DURATION:
		return newDataField[int64](f)
	case arrow.LIST:
		nestedType := f.Type.(*arrow.ListType).ElemField()
		return newField(nestedType)
	default:
		return newDataField[json.RawMessage](f)
	}
}

func newDataField[T any](f arrow.Field) *data.Field {
	if f.Nullable {
		var s []*T
		return data.NewField(f.Name, nil, s)
	}
	var s []T
	return data.NewField(f.Name, nil, s)
}

// copyData copies the contents of an Arrow column into a Data Frame field.
//
//nolint:gocyclo
func copyData(field *data.Field, col arrow.Array) error {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println(fmt.Errorf("panic: %s %s", r, string(debug.Stack())))
		}
	}()

	colData := col.Data()
	switch col.DataType().ID() {
	case arrow.TIMESTAMP:
		v := array.NewTimestampData(colData)
		for i := 0; i < v.Len(); i++ {
			if field.Nullable() {
				if v.IsNull(i) {
					var t *time.Time
					field.Append(t)
					continue
				}
				t := v.Value(i).ToTime(arrow.Nanosecond)
				field.Append(&t)
				continue
			}
			field.Append(v.Value(i).ToTime(arrow.Nanosecond))
		}
	case arrow.DENSE_UNION:
		v := array.NewDenseUnionData(colData)
		for i := 0; i < v.Len(); i++ {
			sc, err := scalar.GetScalar(v, i)
			if err != nil {
				return err
			}
			value := sc.(*scalar.DenseUnion).ChildValue()

			var d any
			switch value.DataType().ID() {
			case arrow.STRING:
				d = value.(*scalar.String).String()
			case arrow.BOOL:
				d = value.(*scalar.Boolean).Value
			case arrow.INT32:
				d = value.(*scalar.Int32).Value
			case arrow.INT64:
				d = value.(*scalar.Int64).Value
			case arrow.LIST:
				d = value.(*scalar.List).Value
			default:
				d = value.(*scalar.Null)
			}
			b, err := json.Marshal(d)
			if err != nil {
				return err
			}
			field.Append(json.RawMessage(b))
		}
	case arrow.LIST:
		v := array.NewListData(colData)
		for i := 0; i < v.Len(); i++ {
			sc, err := scalar.GetScalar(v, i)
			if err != nil {
				return err
			}

			err = copyData(field, sc.(*scalar.List).Value)
			if err != nil {
				return err
			}
		}
	case arrow.STRING_VIEW:
		copyBasic[string](field, array.NewStringViewData(colData))
	case arrow.STRING:
		copyBasic[string](field, array.NewStringData(colData))
	case arrow.UINT8:
		copyBasic[uint8](field, array.NewUint8Data(colData))
	case arrow.UINT16:
		copyBasic[uint16](field, array.NewUint16Data(colData))
	case arrow.UINT32:
		copyBasic[uint32](field, array.NewUint32Data(colData))
	case arrow.UINT64:
		copyBasic[uint64](field, array.NewUint64Data(colData))
	case arrow.INT8:
		copyBasic[int8](field, array.NewInt8Data(colData))
	case arrow.INT16:
		copyBasic[int16](field, array.NewInt16Data(colData))
	case arrow.INT32:
		copyBasic[int32](field, array.NewInt32Data(colData))
	case arrow.INT64:
		copyBasic[int64](field, array.NewInt64Data(colData))
	case arrow.FLOAT32:
		copyBasic[float32](field, array.NewFloat32Data(colData))
	case arrow.FLOAT64:
		copyBasic[float64](field, array.NewFloat64Data(colData))
	case arrow.BOOL:
		copyBasic[bool](field, array.NewBooleanData(colData))
	case arrow.DURATION:
		copyBasic[int64](field, array.NewInt64Data(colData))
	default:
		// FIXME: Should this return an error instead?
		slog.Error("datatype is unhandled", "type", col.DataType().ID())
	}

	return nil
}

type arrowArray[T any] interface {
	IsNull(int) bool
	Value(int) T
	Len() int
}

func copyBasic[T any, Array arrowArray[T]](dst *data.Field, src Array) {
	for i := 0; i < src.Len(); i++ {
		if dst.Nullable() {
			if src.IsNull(i) {
				var s *T
				dst.Append(s)
				continue
			}
			s := src.Value(i)
			dst.Append(&s)
			continue
		}
		dst.Append(src.Value(i))
	}
}
