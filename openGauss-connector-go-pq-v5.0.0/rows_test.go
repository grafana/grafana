package pq

import (
	"math"
	"reflect"
	"testing"

	"gitee.com/opengauss/openGauss-connector-go-pq/oid"
)

func TestDataTypeName(t *testing.T) {
	tts := []struct {
		typ  oid.Oid
		name string
	}{
		{oid.T_int8, "INT8"},
		{oid.T_int4, "INT4"},
		{oid.T_int2, "INT2"},
		{oid.T_varchar, "VARCHAR"},
		{oid.T_text, "TEXT"},
		{oid.T_bool, "BOOL"},
		{oid.T_numeric, "NUMERIC"},
		{oid.T_date, "DATE"},
		{oid.T_time, "TIME"},
		{oid.T_timetz, "TIMETZ"},
		{oid.T_timestamp, "TIMESTAMP"},
		{oid.T_timestamptz, "TIMESTAMPTZ"},
		{oid.T_bytea, "BYTEA"},
	}

	for i, tt := range tts {
		dt := fieldDesc{OID: tt.typ}
		if name := dt.Name(); name != tt.name {
			t.Errorf("(%d) got: %s want: %s", i, name, tt.name)
		}
	}
}

func TestDataType(t *testing.T) {
	tts := []struct {
		typ  oid.Oid
		kind reflect.Kind
	}{
		{oid.T_int8, reflect.Int64},
		{oid.T_int4, reflect.Int32},
		{oid.T_int2, reflect.Int16},
		{oid.T_varchar, reflect.String},
		{oid.T_text, reflect.String},
		{oid.T_bool, reflect.Bool},
		{oid.T_date, reflect.Struct},
		{oid.T_time, reflect.Struct},
		{oid.T_timetz, reflect.Struct},
		{oid.T_timestamp, reflect.Struct},
		{oid.T_timestamptz, reflect.Struct},
		{oid.T_bytea, reflect.Slice},
	}

	for i, tt := range tts {
		dt := fieldDesc{OID: tt.typ}
		if kind := dt.Type().Kind(); kind != tt.kind {
			t.Errorf("(%d) got: %s want: %s", i, kind, tt.kind)
		}
	}
}

func TestDataTypeLength(t *testing.T) {
	tts := []struct {
		typ    oid.Oid
		len    int
		mod    int
		length int64
		ok     bool
	}{
		{oid.T_int4, 0, -1, 0, false},
		{oid.T_varchar, 65535, 9, 5, true},
		{oid.T_text, 65535, -1, math.MaxInt64, true},
		{oid.T_bytea, 65535, -1, math.MaxInt64, true},
	}

	for i, tt := range tts {
		dt := fieldDesc{OID: tt.typ, Len: tt.len, Mod: tt.mod}
		if l, k := dt.Length(); k != tt.ok || l != tt.length {
			t.Errorf("(%d) got: %d, %t want: %d, %t", i, l, k, tt.length, tt.ok)
		}
	}
}

func TestDataTypePrecisionScale(t *testing.T) {
	tts := []struct {
		typ              oid.Oid
		mod              int
		precision, scale int64
		ok               bool
	}{
		{oid.T_int4, -1, 0, 0, false},
		{oid.T_numeric, 589830, 9, 2, true},
		{oid.T_text, -1, 0, 0, false},
	}

	for i, tt := range tts {
		dt := fieldDesc{OID: tt.typ, Mod: tt.mod}
		p, s, k := dt.PrecisionScale()
		if k != tt.ok {
			t.Errorf("(%d) got: %t want: %t", i, k, tt.ok)
		}
		if p != tt.precision {
			t.Errorf("(%d) wrong precision got: %d want: %d", i, p, tt.precision)
		}
		if s != tt.scale {
			t.Errorf("(%d) wrong scale got: %d want: %d", i, s, tt.scale)
		}
	}
}

func TestRowsColumnTypes(t *testing.T) {
	columnTypesTests := []struct {
		Name     string
		TypeName string
		Length   struct {
			Len int64
			OK  bool
		}
		DecimalSize struct {
			Precision int64
			Scale     int64
			OK        bool
		}
		ScanType reflect.Type
	}{
		{
			Name:     "a",
			TypeName: "INT4",
			Length: struct {
				Len int64
				OK  bool
			}{
				Len: 0,
				OK:  false,
			},
			DecimalSize: struct {
				Precision int64
				Scale     int64
				OK        bool
			}{
				Precision: 0,
				Scale:     0,
				OK:        false,
			},
			ScanType: reflect.TypeOf(int32(0)),
		}, {
			Name:     "bar",
			TypeName: "TEXT",
			Length: struct {
				Len int64
				OK  bool
			}{
				Len: math.MaxInt64,
				OK:  true,
			},
			DecimalSize: struct {
				Precision int64
				Scale     int64
				OK        bool
			}{
				Precision: 0,
				Scale:     0,
				OK:        false,
			},
			ScanType: reflect.TypeOf(""),
		},
	}

	db := openTestConn(t)
	defer db.Close()

	rows, err := db.Query("SELECT 1 AS a, text 'bar' AS bar, 1.28::numeric(9, 2) AS dec")
	if err != nil {
		t.Fatal(err)
	}

	columns, err := rows.ColumnTypes()
	if err != nil {
		t.Fatal(err)
	}
	if len(columns) != 3 {
		t.Errorf("expected 3 columns found %d", len(columns))
	}

	for i, tt := range columnTypesTests {
		c := columns[i]
		if c.Name() != tt.Name {
			t.Errorf("(%d) got: %s, want: %s", i, c.Name(), tt.Name)
		}
		if c.DatabaseTypeName() != tt.TypeName {
			t.Errorf("(%d) got: %s, want: %s", i, c.DatabaseTypeName(), tt.TypeName)
		}
		l, ok := c.Length()
		if l != tt.Length.Len {
			t.Errorf("(%d) got: %d, want: %d", i, l, tt.Length.Len)
		}
		if ok != tt.Length.OK {
			t.Errorf("(%d) got: %t, want: %t", i, ok, tt.Length.OK)
		}
		p, s, ok := c.DecimalSize()
		if p != tt.DecimalSize.Precision {
			t.Errorf("(%d) got: %d, want: %d", i, p, tt.DecimalSize.Precision)
		}
		if s != tt.DecimalSize.Scale {
			t.Errorf("(%d) got: %d, want: %d", i, s, tt.DecimalSize.Scale)
		}
		if ok != tt.DecimalSize.OK {
			t.Errorf("(%d) got: %t, want: %t", i, ok, tt.DecimalSize.OK)
		}
		if c.ScanType() != tt.ScanType {
			t.Errorf("(%d) got: %v, want: %v", i, c.ScanType(), tt.ScanType)
		}
	}
}
