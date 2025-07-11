package fsql

import (
	"fmt"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc/metadata"
)

func TestNewQueryDataResponse(t *testing.T) {
	alloc := memory.DefaultAllocator
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "i8", Type: arrow.PrimitiveTypes.Int8},
			{Name: "i16", Type: arrow.PrimitiveTypes.Int16},
			{Name: "i32", Type: arrow.PrimitiveTypes.Int32},
			{Name: "i64", Type: arrow.PrimitiveTypes.Int64},

			{Name: "u8", Type: arrow.PrimitiveTypes.Uint8},
			{Name: "u16", Type: arrow.PrimitiveTypes.Uint16},
			{Name: "u32", Type: arrow.PrimitiveTypes.Uint32},
			{Name: "u64", Type: arrow.PrimitiveTypes.Uint64},

			{Name: "f32", Type: arrow.PrimitiveTypes.Float32},
			{Name: "f64", Type: arrow.PrimitiveTypes.Float64},

			{Name: "utf8", Type: &arrow.StringType{}},
			{Name: "duration", Type: &arrow.DurationType{}},
			{Name: "timestamp", Type: &arrow.TimestampType{}},

			{Name: "item", Type: arrow.ListOf(&arrow.StringType{})},
		},
		nil,
	)

	strValues := []jsonArray{
		newJSONArray(`[1, -2, 3]`, arrow.PrimitiveTypes.Int8),
		newJSONArray(`[1, -2, 3]`, arrow.PrimitiveTypes.Int16),
		newJSONArray(`[1, -2, 3]`, arrow.PrimitiveTypes.Int32),
		newJSONArray(`[1, -2, 3]`, arrow.PrimitiveTypes.Int64),

		newJSONArray(`[1, 2, 3]`, arrow.PrimitiveTypes.Uint8),
		newJSONArray(`[1, 2, 3]`, arrow.PrimitiveTypes.Uint16),
		newJSONArray(`[1, 2, 3]`, arrow.PrimitiveTypes.Uint32),
		newJSONArray(`[1, 2, 3]`, arrow.PrimitiveTypes.Uint64),

		newJSONArray(`[1.1, -2.2, 3.0]`, arrow.PrimitiveTypes.Float32),
		newJSONArray(`[1.1, -2.2, 3.0]`, arrow.PrimitiveTypes.Float64),

		newJSONArray(`["foo", "bar", "baz"]`, &arrow.StringType{}),
		newJSONArray(`[0, 1, -2]`, &arrow.DurationType{}),
		newJSONArray(`[0, 1, 2]`, &arrow.TimestampType{}),

		newJSONArray(`[["test", "test1", "test2"],[],[]]`, arrow.ListOf(&arrow.StringType{})),
	}

	arr := make([]arrow.Array, 0, len(strValues))
	for _, v := range strValues {
		tarr, _, err := array.FromJSON(
			alloc,
			v.dt,
			strings.NewReader(v.json),
		)
		if err != nil {
			t.Fatal(err)
		}
		arr = append(arr, tarr)
	}

	record := array.NewRecord(schema, arr, -1)
	records := []arrow.Record{record}
	reader, err := array.NewRecordReader(schema, records)
	assert.NoError(t, err)

	query := sqlutil.Query{Format: sqlutil.FormatOptionTable}
	resp := newQueryDataResponse(errReader{RecordReader: reader}, query, metadata.MD{})
	assert.NoError(t, resp.Error)
	assert.Len(t, resp.Frames, 1)
	assert.Len(t, resp.Frames[0].Fields, 14)

	frame := resp.Frames[0]
	f0 := frame.Fields[0]
	assert.Equal(t, f0.Name, "i8")
	assert.Equal(t, f0.Type(), data.FieldTypeInt8)
	assert.Equal(t, []int8{1, -2, 3}, extractFieldValues[int8](t, f0))

	f1 := frame.Fields[1]
	assert.Equal(t, f1.Name, "i16")
	assert.Equal(t, f1.Type(), data.FieldTypeInt16)
	assert.Equal(t, []int16{1, -2, 3}, extractFieldValues[int16](t, f1))

	f2 := frame.Fields[2]
	assert.Equal(t, f2.Name, "i32")
	assert.Equal(t, f2.Type(), data.FieldTypeInt32)
	assert.Equal(t, []int32{1, -2, 3}, extractFieldValues[int32](t, f2))

	f3 := frame.Fields[3]
	assert.Equal(t, f3.Name, "i64")
	assert.Equal(t, f3.Type(), data.FieldTypeInt64)
	assert.Equal(t, []int64{1, -2, 3}, extractFieldValues[int64](t, f3))

	f4 := frame.Fields[4]
	assert.Equal(t, f4.Name, "u8")
	assert.Equal(t, f4.Type(), data.FieldTypeUint8)
	assert.Equal(t, []uint8{1, 2, 3}, extractFieldValues[uint8](t, f4))

	f5 := frame.Fields[5]
	assert.Equal(t, f5.Name, "u16")
	assert.Equal(t, f5.Type(), data.FieldTypeUint16)
	assert.Equal(t, []uint16{1, 2, 3}, extractFieldValues[uint16](t, f5))

	f6 := frame.Fields[6]
	assert.Equal(t, f6.Name, "u32")
	assert.Equal(t, f6.Type(), data.FieldTypeUint32)
	assert.Equal(t, []uint32{1, 2, 3}, extractFieldValues[uint32](t, f6))

	f7 := frame.Fields[7]
	assert.Equal(t, f7.Name, "u64")
	assert.Equal(t, f7.Type(), data.FieldTypeUint64)
	assert.Equal(t, []uint64{1, 2, 3}, extractFieldValues[uint64](t, f7))

	f8 := frame.Fields[8]
	assert.Equal(t, f8.Name, "f32")
	assert.Equal(t, f8.Type(), data.FieldTypeFloat32)
	assert.Equal(t, []float32{1.1, -2.2, 3.0}, extractFieldValues[float32](t, f8))

	f9 := frame.Fields[9]
	assert.Equal(t, f9.Name, "f64")
	assert.Equal(t, f9.Type(), data.FieldTypeFloat64)
	assert.Equal(t, []float64{1.1, -2.2, 3.0}, extractFieldValues[float64](t, f9))

	f10 := frame.Fields[10]
	assert.Equal(t, f10.Name, "utf8")
	assert.Equal(t, f10.Type(), data.FieldTypeString)
	assert.Equal(t, []string{"foo", "bar", "baz"}, extractFieldValues[string](t, f10))

	f11 := frame.Fields[11]
	assert.Equal(t, f11.Name, "duration")
	assert.Equal(t, f11.Type(), data.FieldTypeInt64)
	assert.Equal(t, []int64{0, 1, -2}, extractFieldValues[int64](t, f11))

	f12 := frame.Fields[12]
	assert.Equal(t, f12.Name, "timestamp")
	assert.Equal(t, f12.Type(), data.FieldTypeTime)
	assert.Equal(t,
		[]time.Time{
			time.Unix(0, 0).UTC(),
			time.Unix(0, 1).UTC(),
			time.Unix(0, 2).UTC(),
		},
		extractFieldValues[time.Time](t, f12),
	)

	s1 := "test"
	s2 := "test1"
	s3 := "test2"
	f13 := frame.Fields[13]
	assert.Equal(t, f13.Name, "item")
	assert.Equal(t, f13.Type(), data.FieldTypeNullableString)
	assert.Equal(t, []*string{&s1, &s2, &s3}, extractFieldValues[*string](t, f13))
}

type jsonArray struct {
	json string
	dt   arrow.DataType
}

func newJSONArray(json string, dt arrow.DataType) jsonArray {
	return jsonArray{json: json, dt: dt}
}

func TestNewQueryDataResponse_Error(t *testing.T) {
	alloc := memory.DefaultAllocator
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "f1-i64", Type: arrow.PrimitiveTypes.Int64},
			{Name: "f2-f64", Type: arrow.PrimitiveTypes.Float64},
		},
		nil,
	)

	i64s, _, err := array.FromJSON(
		alloc,
		&arrow.Int64Type{},
		strings.NewReader(`[1, 2, 3]`),
	)
	assert.NoError(t, err)
	f64s, _, err := array.FromJSON(
		alloc,
		&arrow.Float64Type{},
		strings.NewReader(`[1.1, 2.2, 3.3]`),
	)
	assert.NoError(t, err)

	record := array.NewRecord(schema, []arrow.Array{i64s, f64s}, -1)
	records := []arrow.Record{record}
	reader, err := array.NewRecordReader(schema, records)
	assert.NoError(t, err)

	wrappedReader := errReader{
		RecordReader: reader,
		err:          fmt.Errorf("explosion!"),
	}
	query := sqlutil.Query{Format: sqlutil.FormatOptionTable}
	resp := newQueryDataResponse(wrappedReader, query, metadata.MD{})
	assert.Error(t, resp.Error)
	assert.Equal(t, fmt.Errorf("explosion!"), resp.Error)
}

func TestNewQueryDataResponse_WideTable(t *testing.T) {
	alloc := memory.DefaultAllocator
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "time", Type: &arrow.TimestampType{}},
			{Name: "label", Type: &arrow.StringType{}},
			{Name: "value", Type: arrow.PrimitiveTypes.Int64},
		},
		nil,
	)

	times, _, err := array.FromJSON(
		alloc,
		&arrow.TimestampType{},
		strings.NewReader(`["2023-01-01T00:00:00Z", "2023-01-01T00:00:01Z", "2023-01-01T00:00:02Z"]`),
	)
	assert.NoError(t, err)
	strs, _, err := array.FromJSON(
		alloc,
		&arrow.StringType{},
		strings.NewReader(`["foo", "bar", "baz"]`),
	)
	assert.NoError(t, err)
	i64s, _, err := array.FromJSON(
		alloc,
		arrow.PrimitiveTypes.Int64,
		strings.NewReader(`[1, 2, 3]`),
	)
	assert.NoError(t, err)

	record := array.NewRecord(schema, []arrow.Array{times, strs, i64s}, -1)
	records := []arrow.Record{record}
	reader, err := array.NewRecordReader(schema, records)
	assert.NoError(t, err)

	resp := newQueryDataResponse(errReader{RecordReader: reader}, sqlutil.Query{}, metadata.MD{})
	assert.NoError(t, resp.Error)
	assert.Len(t, resp.Frames, 1)
	assert.Equal(t, 3, resp.Frames[0].Rows())
	assert.Len(t, resp.Frames[0].Fields, 4)

	frame := resp.Frames[0]
	assert.Equal(t, "time", frame.Fields[0].Name)

	// label=bar
	assert.Equal(t, "value", frame.Fields[1].Name)
	assert.Equal(t, data.Labels{"label": "bar"}, frame.Fields[1].Labels)
	assert.Equal(t, []int64{0, 2, 0}, extractFieldValues[int64](t, frame.Fields[1]))

	// label=baz
	assert.Equal(t, "value", frame.Fields[2].Name)
	assert.Equal(t, data.Labels{"label": "baz"}, frame.Fields[2].Labels)
	assert.Equal(t, []int64{0, 0, 3}, extractFieldValues[int64](t, frame.Fields[2]))

	// label=foo
	assert.Equal(t, "value", frame.Fields[3].Name)
	assert.Equal(t, data.Labels{"label": "foo"}, frame.Fields[3].Labels)
	assert.Equal(t, []int64{1, 0, 0}, extractFieldValues[int64](t, frame.Fields[3]))
}

func extractFieldValues[T any](t *testing.T, field *data.Field) []T {
	t.Helper()

	values := make([]T, 0, field.Len())
	for i := 0; i < cap(values); i++ {
		values = append(values, field.CopyAt(i).(T))
	}
	return values
}

type errReader struct {
	array.RecordReader
	err error
}

func (r errReader) Err() error {
	return r.err
}

func TestNewFrame(t *testing.T) {
	schema := arrow.NewSchema([]arrow.Field{
		{
			Name:     "name",
			Type:     &arrow.StringType{},
			Nullable: false,
			Metadata: arrow.NewMetadata(nil, nil),
		},
		{
			Name:     "time",
			Type:     &arrow.TimestampType{},
			Nullable: false,
			Metadata: arrow.NewMetadata(nil, nil),
		},
		{
			Name:     "extra",
			Type:     &arrow.Int64Type{},
			Nullable: true,
			Metadata: arrow.NewMetadata(nil, nil),
		},
	}, nil)

	actual := newFrame(schema)
	expected := &data.Frame{
		Fields: []*data.Field{
			data.NewField("name", nil, []string{}),
			data.NewField("time", nil, []time.Time{}),
			data.NewField("extra", nil, []*int64{}),
		},
	}
	if !cmp.Equal(expected, actual, cmp.Comparer(cmpFrame)) {
		log.Fatal(cmp.Diff(expected, actual))
	}
}

func cmpFrame(a, b data.Frame) bool {
	if len(a.Fields) != len(b.Fields) {
		return false
	}
	for i := 0; i < len(a.Fields); i++ {
		if a.Fields[i].Name != b.Fields[i].Name {
			return false
		}
		if a.Fields[i].Nullable() != b.Fields[i].Nullable() {
			return false
		}
	}
	return true
}

func TestCopyData_String(t *testing.T) {
	field := data.NewField("field", nil, []string{})
	builder := array.NewStringBuilder(memory.DefaultAllocator)
	builder.Append("joe")
	builder.Append("john")
	builder.Append("jackie")
	err := copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, "joe", field.CopyAt(0))
	assert.Equal(t, "john", field.CopyAt(1))
	assert.Equal(t, "jackie", field.CopyAt(2))

	field = data.NewField("field", nil, []*string{})
	builder = array.NewStringBuilder(memory.DefaultAllocator)
	builder.Append("joe")
	builder.AppendNull()
	builder.Append("jackie")
	err = copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, "joe", *(field.CopyAt(0).(*string)))
	assert.Equal(t, (*string)(nil), field.CopyAt(1))
	assert.Equal(t, "jackie", *(field.CopyAt(2).(*string)))
}

func TestCopyData_Timestamp(t *testing.T) {
	start, _ := time.Parse(time.RFC3339, "2023-01-01T01:01:01Z")

	field := data.NewField("field", nil, []time.Time{})
	builder := array.NewTimestampBuilder(memory.DefaultAllocator, &arrow.TimestampType{})
	builder.Append(arrow.Timestamp(start.Add(time.Hour).UnixNano()))
	builder.Append(arrow.Timestamp(start.Add(2 * time.Hour).UnixNano()))
	builder.Append(arrow.Timestamp(start.Add(3 * time.Hour).UnixNano()))
	err := copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, start.Add(time.Hour), field.CopyAt(0))
	assert.Equal(t, start.Add(2*time.Hour), field.CopyAt(1))
	assert.Equal(t, start.Add(3*time.Hour), field.CopyAt(2))

	field = data.NewField("field", nil, []*time.Time{})
	builder = array.NewTimestampBuilder(memory.DefaultAllocator, &arrow.TimestampType{})
	builder.Append(arrow.Timestamp(start.Add(time.Hour).UnixNano()))
	builder.AppendNull()
	builder.Append(arrow.Timestamp(start.Add(3 * time.Hour).UnixNano()))
	err = copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, start.Add(time.Hour), *field.CopyAt(0).(*time.Time))
	assert.Equal(t, (*time.Time)(nil), field.CopyAt(1))
	assert.Equal(t, start.Add(3*time.Hour), *field.CopyAt(2).(*time.Time))
}

func TestCopyData_Boolean(t *testing.T) {
	field := data.NewField("field", nil, []bool{})
	builder := array.NewBooleanBuilder(memory.DefaultAllocator)
	builder.Append(true)
	builder.Append(false)
	builder.Append(true)
	err := copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, true, field.CopyAt(0))
	assert.Equal(t, false, field.CopyAt(1))
	assert.Equal(t, true, field.CopyAt(2))

	field = data.NewField("field", nil, []*bool{})
	builder = array.NewBooleanBuilder(memory.DefaultAllocator)
	builder.Append(true)
	builder.AppendNull()
	builder.Append(true)
	err = copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, true, *field.CopyAt(0).(*bool))
	assert.Equal(t, (*bool)(nil), field.CopyAt(1))
	assert.Equal(t, true, *field.CopyAt(2).(*bool))
}

func TestCopyData_Int64(t *testing.T) {
	field := data.NewField("field", nil, []int64{})
	builder := array.NewInt64Builder(memory.DefaultAllocator)
	builder.Append(1)
	builder.Append(2)
	builder.Append(3)
	err := copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, int64(1), field.CopyAt(0))
	assert.Equal(t, int64(2), field.CopyAt(1))
	assert.Equal(t, int64(3), field.CopyAt(2))

	field = data.NewField("field", nil, []*int64{})
	builder = array.NewInt64Builder(memory.DefaultAllocator)
	builder.Append(1)
	builder.AppendNull()
	builder.Append(3)
	arr := builder.NewArray()
	err = copyData(field, arr)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), *field.CopyAt(0).(*int64))
	assert.Equal(t, (*int64)(nil), field.CopyAt(1))
	assert.Equal(t, int64(3), *field.CopyAt(2).(*int64))
}

func TestCopyData_Float64(t *testing.T) {
	field := data.NewField("field", nil, []float64{})
	builder := array.NewFloat64Builder(memory.DefaultAllocator)
	builder.Append(1.1)
	builder.Append(2.2)
	builder.Append(3.3)
	err := copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, float64(1.1), field.CopyAt(0))
	assert.Equal(t, float64(2.2), field.CopyAt(1))
	assert.Equal(t, float64(3.3), field.CopyAt(2))

	field = data.NewField("field", nil, []*float64{})
	builder = array.NewFloat64Builder(memory.DefaultAllocator)
	builder.Append(1.1)
	builder.AppendNull()
	builder.Append(3.3)
	err = copyData(field, builder.NewArray())
	assert.NoError(t, err)
	assert.Equal(t, float64(1.1), *field.CopyAt(0).(*float64))
	assert.Equal(t, (*float64)(nil), field.CopyAt(1))
	assert.Equal(t, float64(3.3), *field.CopyAt(2).(*float64))
}

func TestCopyData_StringView(t *testing.T) {
	// Non-nullable StringView
	field := data.NewField("field", nil, []string{})
	builder := array.NewStringViewBuilder(memory.DefaultAllocator)
	builder.Append("apple")
	builder.Append("banana")
	builder.Append("cherry")
	arr := builder.NewArray()
	defer arr.Release()

	svArr := array.NewStringViewData(arr.Data())
	defer svArr.Release()

	err := copyData(field, svArr)
	assert.NoError(t, err)
	assert.Equal(t, "apple", field.CopyAt(0))
	assert.Equal(t, "banana", field.CopyAt(1))
	assert.Equal(t, "cherry", field.CopyAt(2))

	// Nullable StringView
	field = data.NewField("field", nil, []*string{})
	builder = array.NewStringViewBuilder(memory.DefaultAllocator)
	builder.Append("dog")
	builder.AppendNull()
	builder.Append("cat")
	arr2 := builder.NewArray()
	defer arr2.Release()
	svArr2 := array.NewStringViewData(arr2.Data())
	defer svArr2.Release()

	err = copyData(field, svArr2)
	assert.NoError(t, err)
	assert.Equal(t, "dog", *(field.CopyAt(0).(*string)))
	assert.Nil(t, field.CopyAt(1))
	assert.Equal(t, "cat", *(field.CopyAt(2).(*string)))
}

func TestCustomMetadata(t *testing.T) {
	schema := arrow.NewSchema([]arrow.Field{
		{
			Name:     "int64",
			Type:     &arrow.Int64Type{},
			Nullable: true,
			Metadata: arrow.NewMetadata(nil, nil),
		},
	}, nil)
	i64s, _, err := array.FromJSON(
		memory.DefaultAllocator,
		arrow.PrimitiveTypes.Int64,
		strings.NewReader(`[1, 2, 3]`),
	)
	assert.NoError(t, err)

	record := array.NewRecord(schema, []arrow.Array{i64s}, -1)
	records := []arrow.Record{record}
	reader, err := array.NewRecordReader(schema, records)
	assert.NoError(t, err)

	md := metadata.MD{}
	md.Set("trace-id", "abc")
	md.Set("trace-sampled", "true")
	query := sqlutil.Query{
		Format: sqlutil.FormatOptionTable,
	}
	resp := newQueryDataResponse(errReader{RecordReader: reader}, query, md)
	assert.NoError(t, resp.Error)

	assert.Equal(t, map[string]any{
		"headers": metadata.MD{
			"trace-id":      []string{"abc"},
			"trace-sampled": []string{"true"},
		},
	}, resp.Frames[0].Meta.Custom)
}
