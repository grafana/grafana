package dataframe

import (
	"os"
	"testing"
	"time"
)

func TestEncode(t *testing.T) {
	var vals []float64
	var ts []time.Time
	for i := 0; i < 3; i++ {
		vals = append(vals, float64(i))
		ts = append(ts, time.Now())
	}

	df := New("http_requests_total", Labels{"service": "auth"},
		NewField("timestamp", FieldTypeTime, ts),
		NewField("value", FieldTypeNumber, vals),
	)

	f, err := os.Create("dataframe.arrow")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	w := Writer{
		RefID: "A",
		Frame: df,
	}

	if err := w.Write(f); err != nil {
		t.Fatal(err)
	}
}
