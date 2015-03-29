// Copyright (C) 2015 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"database/sql"
	"os"
	"testing"
)

func TestFTS3(t *testing.T) {
	tempFilename := TempFilename()
	db, err := sql.Open("sqlite3", tempFilename)
	if err != nil {
		t.Fatal("Failed to open database:", err)
	}
	defer os.Remove(tempFilename)
	defer db.Close()

	_, err = db.Exec("DROP TABLE foo")
	_, err = db.Exec("CREATE VIRTUAL TABLE foo USING fts3(id INTEGER PRIMARY KEY, value TEXT)")
	if err != nil {
		t.Fatal("Failed to create table:", err)
	}

	_, err = db.Exec("INSERT INTO foo(id, value) VALUES(?, ?)", 1, `今日の 晩御飯は 天麩羅よ`)
	if err != nil {
		t.Fatal("Failed to insert value:", err)
	}

	_, err = db.Exec("INSERT INTO foo(id, value) VALUES(?, ?)", 2, `今日は いい 天気だ`)
	if err != nil {
		t.Fatal("Failed to insert value:", err)
	}

	rows, err := db.Query("SELECT id, value FROM foo WHERE value MATCH '今日* 天*'")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var value string

		if err := rows.Scan(&id, &value); err != nil {
			t.Error("Unable to scan results:", err)
			continue
		}

		if id == 1 && value != `今日の 晩御飯は 天麩羅よ` {
			t.Error("Value for id 1 should be `今日の 晩御飯は 天麩羅よ`, but:", value)
		} else if id == 2 && value != `今日は いい 天気だ` {
			t.Error("Value for id 2 should be `今日は いい 天気だ`, but:", value)
		}
	}

	rows, err = db.Query("SELECT value FROM foo WHERE value MATCH '今日* 天麩羅*'")
	if err != nil {
		t.Fatal("Unable to query foo table:", err)
	}
	defer rows.Close()

	var value string
	if !rows.Next() {
		t.Fatal("Result should be only one")
	}

	if err := rows.Scan(&value); err != nil {
		t.Fatal("Unable to scan results:", err)
	}

	if value != `今日の 晩御飯は 天麩羅よ` {
		t.Fatal("Value should be `今日の 晩御飯は 天麩羅よ`, but:", value)
	}

	if rows.Next() {
		t.Fatal("Result should be only one")
	}
}
