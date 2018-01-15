package tsdb

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/models"
	"testing"
)

func TestMapTables(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)
	var qr = &proto.QueryResult{}
	qr.Tables = append(qr.Tables, &proto.Table{
		Columns: []*proto.TableColumn{},
		Rows:    nil,
	})
	want := []*tsdb.Table{{}}

	have, err := dpw.mapTables(qr)
	if err != nil {
		t.Errorf("failed to map tables. error: %v", err)
	}
	if len(want) != len(have) {
		t.Errorf("could not map all tables")
	}
}

func TestMapTable(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)

	source := &proto.Table{
		Columns: []*proto.TableColumn{{Name: "column1"}, {Name: "column2"}},
		Rows: []*proto.TableRow{{
			Values: []*proto.RowValue{
				{
					Kind:      proto.RowValue_TYPE_BOOL,
					BoolValue: true,
				},
				{
					Kind:       proto.RowValue_TYPE_INT64,
					Int64Value: 42,
				},
			},
		}},
	}

	want := &tsdb.Table{
		Columns: []tsdb.TableColumn{{Text: "column1"}, {Text: "column2"}},
	}
	have, err := dpw.mapTable(source)
	if err != nil {
		t.Fatalf("failed to map table. error: %v", err)
	}

	for i := range have.Columns {
		if want.Columns[i] != have.Columns[i] {
			t.Fatalf("have column: %s, want %s", have, want)
		}
	}

	if len(have.Rows) != 1 {
		t.Fatalf("Expects one row but got %d", len(have.Rows))
	}

	rowValuesCount := len(have.Rows[0])
	if rowValuesCount != 2 {
		t.Fatalf("Expects two row values, got %d", rowValuesCount)
	}
}

func TestMappingRowValue(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)

	boolRowValue, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_BOOL, BoolValue: true})
	haveBool, ok := boolRowValue.(bool)
	if !ok || haveBool != true {
		t.Fatalf("Expected true, was %s", haveBool)
	}

	intRowValue, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_INT64, Int64Value: 42})
	haveInt, ok := intRowValue.(int64)
	if !ok || haveInt != 42 {
		t.Fatalf("Expected %d, was %d", 42, haveInt)
	}

	stringRowValue, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_STRING, StringValue: "grafana"})
	haveString, ok := stringRowValue.(string)
	if !ok || haveString != "grafana" {
		t.Fatalf("Expected %s, was %s", "grafana", haveString)
	}

	doubleRowValue, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_DOUBLE, DoubleValue: 1.5})
	haveDouble, ok := doubleRowValue.(float64)
	if !ok || haveDouble != 1.5 {
		t.Fatalf("Expected %v, was %v", 1.5, haveDouble)
	}

	bytesRowValue, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_BYTES, BytesValue: []byte{66}})
	haveBytes, ok := bytesRowValue.([]byte)
	if !ok || len(haveBytes) != 1 || haveBytes[0] != 66 {
		t.Fatalf("Expected %v, was %v", []byte{66}, haveBytes)
	}

	haveNil, _ := dpw.mapRowValue(&proto.RowValue{Kind: proto.RowValue_TYPE_NULL})
	if haveNil != nil {
		t.Fatalf("Expected %v, was %v", nil, haveNil)
	}
}
