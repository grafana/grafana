package sqltemplate

import (
	"reflect"
	"slices"
	"testing"
)

func TestScanDest_Into(t *testing.T) {
	t.Parallel()

	var d ScanDest

	colName, err := d.Into(reflect.Value{}, "some field")
	if colName != "" || err == nil || len(d.GetScanDest()) != 0 {
		t.Fatalf("unexpected outcome, got colname %q, err: %v, scan dest: %#v",
			colName, err, d)
	}

	data := struct {
		X int
		Y byte
	}{}
	dataVal := reflect.ValueOf(&data).Elem()

	expectedColNames := []string{"some int", "and a byte"}

	colName, err = d.Into(dataVal.FieldByName("X"), expectedColNames[0])
	v := d.GetScanDest()
	if err != nil || colName != expectedColNames[0] || len(v) != 1 || v[0] != &data.X {
		t.Fatalf("unexpected outcome, got colname %q, err: %v, scan dest: %#v",
			colName, err, d)
	}

	colName, err = d.Into(dataVal.FieldByName("Y"), expectedColNames[1])
	v = d.GetScanDest()
	if err != nil || colName != expectedColNames[1] || len(v) != 2 || v[1] != &data.Y {
		t.Fatalf("unexpected outcome, got colname %q, err: %v, scan dest: %#v",
			colName, err, d)
	}

	if gotColNames := d.GetColNames(); !slices.Equal(expectedColNames, gotColNames) {
		t.Fatalf("unexpected column names: %v", gotColNames)
	}

	d.Reset()
	v = d.GetScanDest()
	if len(v) != 0 {
		t.Fatalf("unexpected values after reset: %v", v)
	}
}
