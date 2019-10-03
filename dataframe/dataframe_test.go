package dataframe_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
)

func TestNewField(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0})

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}
}

func TestNewDataFrame(t *testing.T) {
	df := dataframe.New("http_requests_total", dataframe.Labels{"service": "auth"},
		dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{time.Now(), time.Now(), time.Now()}),
		dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{1.0, 2.0, 3.0}),
		dataframe.NewField("category", dataframe.FieldTypeString, []string{"foo", "bar", "test"}),
		dataframe.NewField("valid", dataframe.FieldTypeBoolean, []bool{true, false, true}),
	)

	if df.Rows() != 3 {
		t.Fatal("unexpected length")
	}
}

func TestNewField_Float64(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeNumber, make([]*float64, 3))

	want := 2.0
	f.Vector.Set(1, &want)

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}

	got := f.Vector.At(1).(*float64)

	if *got != want {
		t.Errorf("%+v", *got)
	}
}

func TestNewField_String(t *testing.T) {
	f := dataframe.NewField("value", dataframe.FieldTypeString, make([]*string, 3))

	want := "foo"
	f.Vector.Set(1, &want)

	if f.Len() != 3 {
		t.Fatal("unexpected length")
	}

	got := f.Vector.At(1).(*string)

	if *got != want {
		t.Errorf("%+v", *got)
	}
}
