package grafana

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
)

func TestAsTable(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"},
		dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{time.Now(), time.Now(), time.Now()}),
		dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0}),
		dataframe.NewField("category", dataframe.FieldTypeString, []string{"foo", "bar", "test"}),
		dataframe.NewField("hidden", dataframe.FieldTypeBoolean, []bool{true, false, false}),
	)

	table := asTable(df)

	if len(table.Columns) != 4 {
		t.Errorf("cols = %v", len(table.Columns))
	}

	wantName := []string{"timestamp", "value", "category", "hidden"}

	for i := 0; i < len(wantName); i++ {
		if table.Columns[i].Name != wantName[i] {
			t.Fatalf("got = %s; want = %s", table.Columns[i].Name, wantName[i])
		}
	}

	if len(table.Rows) != 3 {
		t.Errorf("rows = %+v", len(table.Rows))
	}

	wantKind := []datasource.RowValue_Kind{
		datasource.RowValue_TYPE_DOUBLE,
		datasource.RowValue_TYPE_DOUBLE,
		datasource.RowValue_TYPE_STRING,
		datasource.RowValue_TYPE_BOOL,
	}

	for _, r := range table.Rows {
		if len(r.Values) != len(wantKind) {
			t.Fatalf("got = %d; want = %d", len(r.Values), len(wantKind))
		}

		for i := 0; i < len(wantKind); i++ {
			if r.Values[i].Kind != wantKind[i] {
				t.Fatalf("got = %s; want = %s", r.Values[i].Kind, wantKind[i])
			}
		}
	}

}

func TestAsTable_EmptyDataFrame(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"})

	table := asTable(df)

	if len(table.Columns) != 0 {
		t.Errorf("cols = %v", len(table.Columns))
	}

	if len(table.Rows) != 0 {
		t.Errorf("cols = %v", len(table.Columns))
	}
}
