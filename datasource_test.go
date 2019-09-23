package grafana

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
)

func TestAsTable(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"},
		dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{time.Now(), time.Now(), time.Now()}),
		dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0}),
		dataframe.NewField("category", dataframe.FieldTypeString, []string{"foo", "bar", "test"}),
	)

	table := asTable(df)

	if len(table.Columns) != 3 {
		t.Errorf("cols = %v", len(table.Columns))
	}

	if len(table.Rows) != 3 {
		t.Errorf("rows = %+v", len(table.Rows))

		for _, r := range table.Rows {
			t.Logf("%+v", r)
		}
	}
}
