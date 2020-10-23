package wrapper

import (
	"testing"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestMapTables(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)
	var qr = &datasource.QueryResult{}
	qr.Tables = append(qr.Tables, &datasource.Table{
		Columns: []*datasource.TableColumn{},
		Rows:    nil,
	})

	have, err := dpw.mapTables(qr)
	require.NoError(t, err)
	require.Len(t, have, 1)
}

func TestMapTable(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)

	source := &datasource.Table{
		Columns: []*datasource.TableColumn{{Name: "column1"}, {Name: "column2"}},
		Rows: []*datasource.TableRow{{
			Values: []*datasource.RowValue{
				{
					Kind:      datasource.RowValue_TYPE_BOOL,
					BoolValue: true,
				},
				{
					Kind:       datasource.RowValue_TYPE_INT64,
					Int64Value: 42,
				},
			},
		}},
	}

	want := &tsdb.Table{
		Columns: []tsdb.TableColumn{{Text: "column1"}, {Text: "column2"}},
	}
	have, err := dpw.mapTable(source)
	require.NoError(t, err)

	require.Equal(t, want.Columns, have.Columns)
	require.Len(t, have.Rows, 1)
	require.Len(t, have.Rows[0], 2)
}

func TestMappingRowValue(t *testing.T) {
	dpw := NewDatasourcePluginWrapper(log.New("test-logger"), nil)

	boolRowValue, _ := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_BOOL, BoolValue: true})
	haveBool, ok := boolRowValue.(bool)
	require.True(t, ok)
	require.True(t, haveBool)

	intRowValue, _ := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_INT64, Int64Value: 42})
	haveInt, ok := intRowValue.(int64)
	require.True(t, ok)
	require.Equal(t, int64(42), haveInt)

	stringRowValue, _ := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_STRING, StringValue: "grafana"})
	haveString, ok := stringRowValue.(string)
	require.True(t, ok)
	require.Equal(t, "grafana", haveString)

	doubleRowValue, _ := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_DOUBLE, DoubleValue: 1.5})
	haveDouble, ok := doubleRowValue.(float64)
	require.True(t, ok)
	require.Equal(t, 1.5, haveDouble)

	bytesRowValue, _ := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_BYTES, BytesValue: []byte{66}})
	haveBytes, ok := bytesRowValue.([]byte)
	require.True(t, ok)
	require.Equal(t, []byte{66}, haveBytes)

	haveNil, err := dpw.mapRowValue(&datasource.RowValue{Kind: datasource.RowValue_TYPE_NULL})
	require.NoError(t, err)
	require.Nil(t, haveNil)
}
