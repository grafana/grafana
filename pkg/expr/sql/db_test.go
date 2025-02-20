//go:build !arm

package sql

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestQueryFrames(t *testing.T) {
	db := DB{}

	tests := []struct {
		name         string
		query        string
		input_frames []*data.Frame
		expected     *data.Frame
	}{
		{
			name:         "valid query with no input frames, one row one column",
			query:        `SELECT '1' AS 'n';`,
			input_frames: []*data.Frame{},
			expected: data.NewFrame(
				"sqlExpressionRefId",
				data.NewField("n", nil, []string{"1"}),
			).SetRefID("sqlExpressionRefId"),
		},
		{
			name:         "valid query with no input frames, one row two columns",
			query:        `SELECT 'sam' AS 'name', 40 AS 'age';`,
			input_frames: []*data.Frame{},
			expected: data.NewFrame(
				"sqlExpressionRefId",
				data.NewField("name", nil, []string{"sam"}),
				data.NewField("age", nil, []int8{40}),
			).SetRefID("sqlExpressionRefId"),
		},
		{
			// TODO: Also ORDER BY to ensure the order is preserved
			name:  "query all rows from single input frame",
			query: `SELECT * FROM inputFrameRefId LIMIT 1;`,
			input_frames: []*data.Frame{
				data.NewFrame(
					"",
					//nolint:misspell
					data.NewField("OSS Projects with Typos", nil, []string{"Garfana", "Pormetheus"}),
				).SetRefID("inputFrameRefId"),
			},
			expected: data.NewFrame(
				"sqlExpressionRefId",
				data.NewField("OSS Projects with Typos", nil, []string{"Garfana"}),
			).SetRefID("sqlExpressionRefId"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			frame, err := db.QueryFrames(context.Background(), "sqlExpressionRefId", tt.query, tt.input_frames)
			require.NoError(t, err)

			if diff := cmp.Diff(tt.expected, frame, data.FrameTestCompareOptions()...); diff != "" {
				require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
			}
		})
	}
}

func TestQueryFramesInOut(t *testing.T) {
	frameA := &data.Frame{
		RefID: "a",
		Name:  "a",
		Fields: []*data.Field{
			data.NewField("time", nil, []time.Time{time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC), time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)}),
			data.NewField("time_nullable", nil, []*time.Time{p(time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)), nil}),

			data.NewField("string", nil, []string{"cat", "dog"}),
			data.NewField("null_nullable", nil, []*string{p("cat"), nil}),

			data.NewField("bool", nil, []bool{true, false}),
			data.NewField("bool_nullable", nil, []*bool{p(true), nil}),

			// Floats
			data.NewField("float32", nil, []float32{1, 3}),
			data.NewField("float32_nullable", nil, []*float32{p(float32(2.0)), nil}),

			data.NewField("float64", nil, []float64{1, 3}),
			data.NewField("float64_nullable", nil, []*float64{p(float64(2.0)), nil}),

			// Ints
			data.NewField("int8", nil, []int8{1, 3}),
			data.NewField("int8_nullable", nil, []*int8{p(int8(2)), nil}),

			data.NewField("int16", nil, []int16{1, 3}),
			data.NewField("int16_nullable", nil, []*int16{p(int16(2)), nil}),

			data.NewField("int32", nil, []int32{1, 3}),
			data.NewField("int32_nullable", nil, []*int32{p(int32(2)), nil}),

			data.NewField("int64", nil, []int64{1, 3}),
			data.NewField("int64_nullable", nil, []*int64{p(int64(2)), nil}),

			// Unsigned Ints
			data.NewField("uint8", nil, []uint8{1, 3}),
			data.NewField("uint8_nullable", nil, []*uint8{p(uint8(2)), nil}),

			data.NewField("uint16", nil, []uint16{1, 3}),
			data.NewField("uint16_nullable", nil, []*uint16{p(uint16(2)), nil}),

			data.NewField("uint32", nil, []uint32{1, 3}),
			data.NewField("uint32_nullable", nil, []*uint32{p(uint32(2)), nil}),

			data.NewField("uint64", nil, []uint64{1, 3}),
			data.NewField("uint64_nullable", nil, []*uint64{p(uint64(2)), nil}),
		},
	}

	db := DB{}
	qry := `SELECT * from a`

	resultFrame, err := db.QueryFrames(context.Background(), "a", qry, []*data.Frame{frameA})
	require.NoError(t, err)

	if diff := cmp.Diff(frameA, resultFrame, data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func TestQueryFramesNumericSelect(t *testing.T) {
	expectedFrame := &data.Frame{
		RefID: "a",
		Name:  "a",
		Fields: []*data.Field{
			data.NewField("decimal", nil, []float64{2.35}),
			data.NewField("tinySigned", nil, []int8{-128}),
			data.NewField("smallSigned", nil, []int16{-32768}),
			data.NewField("mediumSigned", nil, []int32{-8388608}),
			data.NewField("intSigned", nil, []int32{-2147483648}),
			data.NewField("bigSigned", nil, []int64{-9223372036854775808}),
			data.NewField("tinyUnsigned", nil, []uint8{255}),
			data.NewField("smallUnsigned", nil, []uint16{65535}),
			data.NewField("mediumUnsigned", nil, []int32{16777215}),
			data.NewField("intUnsigned", nil, []uint32{4294967295}),
			data.NewField("bigUnsigned", nil, []uint64{18446744073709551615}),
		},
	}

	db := DB{}
	qry := `SELECT 2.35 AS 'decimal', 
	-128 AS 'tinySigned', 
	-32768 AS 'smallSigned', 
	-8388608 AS 'mediumSigned', 
	-2147483648 AS 'intSigned',
	-9223372036854775808 AS 'bigSigned',
	255 AS 'tinyUnsigned', 
	65535 AS 'smallUnsigned', 
	16777215 AS 'mediumUnsigned', 
	4294967295 AS 'intUnsigned',
	18446744073709551615 AS 'bigUnsigned'`

	resultFrame, err := db.QueryFrames(context.Background(), "a", qry, []*data.Frame{})
	require.NoError(t, err)

	if diff := cmp.Diff(expectedFrame, resultFrame, data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func TestQueryFramesDateTimeSelect(t *testing.T) {
	expectedFrame := &data.Frame{
		RefID: "a",
		Name:  "a",
		Fields: []*data.Field{
			data.NewField("ts", nil, []*time.Time{
				p(time.Date(2025, 2, 3, 3, 0, 0, 0, time.UTC)),
			}),
		},
	}

	db := DB{}

	qry := `SELECT str_to_date('2025-02-03T03:00:00','%Y-%m-%dT%H:%i:%s') as ts`

	f, err := db.QueryFrames(context.Background(), "a", qry, nil)
	require.NoError(t, err)

	if diff := cmp.Diff(expectedFrame, f, data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

// p is a utility for pointers from constants
func p[T any](v T) *T {
	return &v
}
