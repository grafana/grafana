package prql

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestAppend(t *testing.T) {

	var fields []*data.Field
	vals := []string{"test"}
	f := data.NewField("name", nil, vals)
	fields = append(fields, f)
	frame := data.NewFrame("foo", fields...)

	d := DuckDB{
		Name: "test.db",
	}

	err := d.AppendAll(context.Background(), data.Frames{frame})
	if err != nil {
		t.Fail()
	}
}
