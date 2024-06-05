package sqltemplate

import (
	"reflect"
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

	colName, err = d.Into(dataVal.FieldByName("X"), "some int")
	v := d.GetScanDest()
	if err != nil || colName != "some int" || len(v) != 1 || v[0] != &data.X {
		t.Fatalf("unexpected outcome, got colname %q, err: %v, scan dest: %#v",
			colName, err, d)
	}

	colName, err = d.Into(dataVal.FieldByName("Y"), "some byte")
	v = d.GetScanDest()
	if err != nil || colName != "some byte" || len(v) != 2 || v[1] != &data.Y {
		t.Fatalf("unexpected outcome, got colname %q, err: %v, scan dest: %#v",
			colName, err, d)
	}
}
