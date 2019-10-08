package dataframe_test

import (
	"bytes"
	"flag"
	"io/ioutil"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/plugins/sdk/dataframe"
)

var update = flag.Bool("update", false, "update .golden.arrow files")

func TestEncode(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"},
		dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{
			time.Unix(1568039445, 0),
			time.Unix(1568039450, 0),
			time.Unix(1568039455, 0),
		}),
		dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{
			0.0,
			1.0,
			2.0,
		}),
	)

	df.RefID = "A"

	b, err := dataframe.MarshalArrow(df)
	if err != nil {
		t.Fatal(err)
	}

	goldenFile := filepath.Join("testdata", "timeseries.golden.arrow")

	if *update {
		if err := ioutil.WriteFile(goldenFile, b, 0644); err != nil {
			t.Fatal(err)
		}
	}

	want, err := ioutil.ReadFile(goldenFile)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(b, want) {
		t.Fatalf("data frame doesn't match golden file")
	}
}
