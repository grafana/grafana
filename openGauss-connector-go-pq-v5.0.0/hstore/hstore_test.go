package hstore

import (
	"database/sql"
	_ "gitee.com/opengauss/openGauss-connector-go-pq"
	"os"
)

type Fatalistic interface {
	Fatal(args ...interface{})
}

func openTestConn(t Fatalistic) *sql.DB {
	datname := os.Getenv("PGDATABASE")
	sslmode := os.Getenv("PGSSLMODE")

	if datname == "" {
		os.Setenv("PGDATABASE", "pqgotest")
	}

	if sslmode == "" {
		os.Setenv("PGSSLMODE", "disable")
	}

	conn, err := sql.Open("opengauss", "")
	if err != nil {
		t.Fatal(err)
	}

	return conn
}

// func TestHstore(t *testing.T) {
// 	db := openTestConn(t)
// 	defer db.Close()
//
// 	// quietly create hstore if it doesn't exist
// 	_, err := db.Exec("CREATE EXTENSION IF NOT EXISTS hstore")
// 	if err != nil {
// 		t.Skipf("Skipping hstore tests - hstore extension create failed: %s", err.Error())
// 	}
//
// 	hs := Hstore{}
//
// 	// test for null-valued hstores
// 	err = db.QueryRow("SELECT NULL::hstore").Scan(&hs)
// 	if err != nil {
// 		t.Fatal(err)
// 	}
// 	if hs.Map != nil {
// 		t.Fatalf("expected null map")
// 	}
//
// 	err = db.QueryRow("SELECT $1::hstore", hs).Scan(&hs)
// 	if err != nil {
// 		t.Fatalf("re-query null map failed: %s", err.Error())
// 	}
// 	if hs.Map != nil {
// 		t.Fatalf("expected null map")
// 	}
//
// 	// test for empty hstores
// 	err = db.QueryRow("SELECT ''::hstore").Scan(&hs)
// 	if err != nil {
// 		t.Fatal(err)
// 	}
// 	if hs.Map == nil {
// 		t.Fatalf("expected empty map, got null map")
// 	}
// 	if len(hs.Map) != 0 {
// 		t.Fatalf("expected empty map, got len(map)=%d", len(hs.Map))
// 	}
//
// 	err = db.QueryRow("SELECT $1::hstore", hs).Scan(&hs)
// 	if err != nil {
// 		t.Fatalf("re-query empty map failed: %s", err.Error())
// 	}
// 	if hs.Map == nil {
// 		t.Fatalf("expected empty map, got null map")
// 	}
// 	if len(hs.Map) != 0 {
// 		t.Fatalf("expected empty map, got len(map)=%d", len(hs.Map))
// 	}
//
// 	// a few example maps to test out
// 	hsOnePair := Hstore{
// 		Map: map[string]sql.NullString{
// 			"key1": {String: "value1", Valid: true},
// 		},
// 	}
//
// 	hsThreePairs := Hstore{
// 		Map: map[string]sql.NullString{
// 			"key1": {String: "value1", Valid: true},
// 			"key2": {String: "value2", Valid: true},
// 			"key3": {String: "value3", Valid: true},
// 		},
// 	}
//
// 	hsSmorgasbord := Hstore{
// 		Map: map[string]sql.NullString{
// 			"nullstring":             {String: "NULL", Valid: true},
// 			"actuallynull":           {String: "", Valid: false},
// 			"NULL":                   {String: "NULL string key", Valid: true},
// 			"withbracket":            {String: "value>42", Valid: true},
// 			"withequal":              {String: "value=42", Valid: true},
// 			`"withquotes1"`:          {String: `this "should" be fine`, Valid: true},
// 			`"withquotes"2"`:         {String: `this "should\" also be fine`, Valid: true},
// 			"embedded1":              {String: "value1=>x1", Valid: true},
// 			"embedded2":              {String: `"value2"=>x2`, Valid: true},
// 			"withnewlines":           {String: "\n\nvalue\t=>2", Valid: true},
// 			"<<all sorts of crazy>>": {String: `this, "should,\" also, => be fine`, Valid: true},
// 		},
// 	}
//
// 	// test encoding in query params, then decoding during Scan
// 	testBidirectional := func(h Hstore) {
// 		err = db.QueryRow("SELECT $1::hstore", h).Scan(&hs)
// 		if err != nil {
// 			t.Fatalf("re-query %d-pair map failed: %s", len(h.Map), err.Error())
// 		}
// 		if hs.Map == nil {
// 			t.Fatalf("expected %d-pair map, got null map", len(h.Map))
// 		}
// 		if len(hs.Map) != len(h.Map) {
// 			t.Fatalf("expected %d-pair map, got len(map)=%d", len(h.Map), len(hs.Map))
// 		}
//
// 		for key, val := range hs.Map {
// 			otherval, found := h.Map[key]
// 			if !found {
// 				t.Fatalf("  key '%v' not found in %d-pair map", key, len(h.Map))
// 			}
// 			if otherval.Valid != val.Valid {
// 				t.Fatalf("  value %v <> %v in %d-pair map", otherval, val, len(h.Map))
// 			}
// 			if otherval.String != val.String {
// 				t.Fatalf("  value '%v' <> '%v' in %d-pair map", otherval.String, val.String, len(h.Map))
// 			}
// 		}
// 	}
//
// 	testBidirectional(hsOnePair)
// 	testBidirectional(hsThreePairs)
// 	testBidirectional(hsSmorgasbord)
// }
