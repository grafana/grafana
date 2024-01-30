package sql

import (
	"context"
	"fmt"
	"testing"

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

	out, err := d.Query(ctx, "SELECT * FROM foo LIMIT 3")
	require.NoError(t, err)
	require.Equal(t, 3, out.Rows())
	require.Equal(t, "SELECT * FROM foo LIMIT 3", out.Meta.ExecutedQueryString)

	txt, err := out.StringTable(-1, -1)
	require.NoError(t, err)

	fmt.Printf("GOT: %s", txt)
}
