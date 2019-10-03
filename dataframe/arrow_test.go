package dataframe

import (
	"bytes"
	"flag"
	"io/ioutil"
	"path/filepath"
	"testing"
	"time"
)

var update = flag.Bool("update", false, "update .golden.arrow files")

func TestEncode(t *testing.T) {
	df := New("http_requests_total", Labels{"service": "auth"},
		NewField("timestamp", FieldTypeTime, []time.Time{
			time.Unix(1568039445, 0),
			time.Unix(1568039450, 0),
			time.Unix(1568039455, 0),
		}),
		NewField("value", FieldTypeNumber, []float64{
			0.0,
			1.0,
			2.0,
		}),
	)

	w := Writer{
		RefID: "A",
		Frame: df,
	}

	var buf bytes.Buffer
	if err := w.Write(&buf); err != nil {
		t.Fatal(err)
	}

	goldenFile := filepath.Join("testdata", "timeseries.golden.arrow")

	if *update {
		if err := ioutil.WriteFile(goldenFile, buf.Bytes(), 0644); err != nil {
			t.Fatal(err)
		}
	}

	want, err := ioutil.ReadFile(goldenFile)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(buf.Bytes(), want) {
		t.Fatalf("data frame doesn't match golden file")
	}
}
