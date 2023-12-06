package prql

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestAppend(t *testing.T) {

	var fields []*data.Field
	vals := []string{"test"}
	labels := data.Labels{
		"foo": "bar",
		"cat": "zzz",
	}
	f := data.NewField("name", labels, vals)
	fields = append(fields, f)
	frame := data.NewFrame("foo", fields...)
	frame.RefID = "foo"

	d := DuckDB{
		Name: "test.db",
	}

	err := d.AppendAll(context.Background(), data.Frames{frame})
	if err != nil {
		t.Fail()
	}
}
