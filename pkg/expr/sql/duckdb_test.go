//go:build !requires_buildifer
// +build !requires_buildifer

package sql

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestAppend(t *testing.T) {
	ctx := context.Background()
	var fields []*data.Field
	vals := []string{"v1", "v2", "v3"}
	labels := data.Labels{
		"foo": "bar",
		"cat": "zzz",
	}
	f := data.NewField("name", labels, vals)

	labels2 := data.Labels{
		"aaa": "bbb",
		"ccc": "ddd",
	}
	vals2 := []string{"x1", "x2", "x3"}
	f2 := data.NewField("value", labels2, vals2)

	fields = append(fields, f)
	fields = append(fields, f2)
	frame := data.NewFrame("x", fields...)
	frame.RefID = "foo"

	d, err := NewInMemoryDB(ctx)
	require.NoError(t, err)

	err = d.AppendAll(ctx, data.Frames{frame})
	require.NoError(t, err)

	out, err := d.Query(ctx, "SELECT * FROM foo LIMIT 1")
	require.NoError(t, err)
	require.Equal(t, 1, out.Rows())
	require.Equal(t, "SELECT * FROM foo LIMIT 1", out.Meta.ExecutedQueryString)

	txt, err := out.StringTable(-1, -1)
	require.NoError(t, err)

	fmt.Printf("GOT: %s", txt)
}

func TestSeries(t *testing.T) {
	frame := createTimeSeriesFrame("foo", "A-Series")
	frame2 := createTimeSeriesFrame("foo", "A-Series2")

	ctx := context.Background()
	d, err := NewInMemoryDB(ctx)
	require.NoError(t, err)

	err = d.AppendAll(ctx, data.Frames{frame, frame2})
	require.NoError(t, err)

	out, err := d.Query(ctx, "SELECT * FROM foo LIMIT 4")
	require.NoError(t, err)

	require.Equal(t, 4, out.Rows())

	txt, err := out.StringTable(-1, -1)
	require.NoError(t, err)

	fmt.Printf("GOT: %s", txt)
}

func createTimeSeriesFrame(refID string, field string) *data.Frame {
	var fields []*data.Field

	vals := []time.Time{
		time.Time{}.Add(22000),
		time.Time{}.Add(10000),
	}
	f := data.NewField("time", nil, vals)

	vals2 := []float64{
		3.3,
		3.4,
	}

	f2 := data.NewField(field, nil, vals2)

	fields = append(fields, f)
	fields = append(fields, f2)
	frame := data.NewFrame("x", fields...)
	frame.RefID = refID
	return frame
}
