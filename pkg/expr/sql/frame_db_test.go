package sql

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestFrameDBInOut(t *testing.T) {
	frameA := &data.Frame{
		RefID: "a",
		Name:  "a",
		Fields: []*data.Field{
			data.NewField("time", nil, []time.Time{time.Now(), time.Now(), time.Now(), time.Now()}),
			data.NewField("ntime", nil, []*time.Time{p(time.Now()), nil, p(time.Now()), p(time.Now())}),
			data.NewField("animal", nil, []string{"cat", "dog", "cat", "dog"}),
			data.NewField("nanimal", nil, []*string{p("cat"), nil, p("cat"), p("dog")}),
			data.NewField("fcount", nil, []float64{1, 3, 4, 7}),
			data.NewField("nfcount", nil, []*float64{p(2.0), nil, p(8.0), p(14.0)}),
			data.NewField("nfcountnn", nil, []*float64{p(2.0), p(4.0), p(8.0), p(14.0)}),
			data.NewField("i64count", nil, []int64{1, 3, 4, 7}),
			data.NewField("ni64count", nil, []*int64{p(int64(2)), nil, p(int64(8)), p(int64(14))}),
			data.NewField("bool", nil, []bool{true, false, true, false}),
			data.NewField("nbool", nil, []*bool{p(true), nil, p(true), p(false)}),
		},
	}

	db := DB{}
	qry := `SELECT * from A`

	f, err := db.QueryFrames(context.Background(), "a", qry, []*data.Frame{frameA})
	require.NoError(t, err)

	if diff := cmp.Diff(frameA, f, data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func TestFrameDBNumericSelect(t *testing.T) {
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

	f, err := db.QueryFrames(context.Background(), "a", qry, []*data.Frame{})
	require.NoError(t, err)

	if diff := cmp.Diff(expectedFrame, f, data.FrameTestCompareOptions()...); diff != "" {
		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
	}
}

func p[T any](v T) *T {
	return &v
}

// func TestFrameDBTimeSelect(t *testing.T) {
// 	expectedFrame := &data.Frame{
// 		RefID: "a",
// 		Name:  "a",
// 		Fields: []*data.Field{
// 			data.NewField("ts", nil, []time.Time{}),
// 		},
// 	}

// 	db := DB{}

// 	// It doesn't like the T in the time string
// 	qry := `SELECT str_to_date('2025-02-03T03:00:00','%Y-%m-%dT%H:%i:%s') as ts`

// 	// This comes back as a string, which needs to be dealt with?
// 	//qry := `SELECT str_to_date('2025-02-03-03:00:00','%Y-%m-%d-%H:%i:%s') as ts`

// 	// This is a datetime(6), need to deal with that as well
// 	//qry := `SELECT current_timestamp() as ts`

// 	f, err := db.QueryFrames("a", qry, []*data.Frame{})
// 	require.NoError(t, err)

// 	if diff := cmp.Diff(expectedFrame, f, data.FrameTestCompareOptions()...); diff != "" {
// 		require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
// 	}
// }
