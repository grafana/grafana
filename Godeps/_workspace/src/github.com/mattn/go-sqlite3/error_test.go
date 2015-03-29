// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"database/sql"
	"io/ioutil"
	"os"
	"path"
	"testing"
)

func TestSimpleError(t *testing.T) {
	e := ErrError.Error()
	if e != "SQL logic error or missing database" {
		t.Error("wrong error code:" + e)
	}
}

func TestCorruptDbErrors(t *testing.T) {
	dirName, err := ioutil.TempDir("", "sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirName)

	dbFileName := path.Join(dirName, "test.db")
	f, err := os.Create(dbFileName)
	if err != nil {
		t.Error(err)
	}
	f.Write([]byte{1, 2, 3, 4, 5})
	f.Close()

	db, err := sql.Open("sqlite3", dbFileName)
	if err == nil {
		_, err = db.Exec("drop table foo")
	}

	sqliteErr := err.(Error)
	if sqliteErr.Code != ErrNotADB {
		t.Error("wrong error code for corrupted DB")
	}
	if err.Error() == "" {
		t.Error("wrong error string for corrupted DB")
	}
	db.Close()
}

func TestSqlLogicErrors(t *testing.T) {
	dirName, err := ioutil.TempDir("", "sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirName)

	dbFileName := path.Join(dirName, "test.db")
	db, err := sql.Open("sqlite3", dbFileName)
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec("CREATE TABLE Foo (id INTEGER PRIMARY KEY)")
	if err != nil {
		t.Error(err)
	}

	const expectedErr = "table Foo already exists"
	_, err = db.Exec("CREATE TABLE Foo (id INTEGER PRIMARY KEY)")
	if err.Error() != expectedErr {
		t.Errorf("Unexpected error: %s, expected %s", err.Error(), expectedErr)
	}

}

func TestExtendedErrorCodes_ForeignKey(t *testing.T) {
	dirName, err := ioutil.TempDir("", "sqlite3-err")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirName)

	dbFileName := path.Join(dirName, "test.db")
	db, err := sql.Open("sqlite3", dbFileName)
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec("PRAGMA foreign_keys=ON;")
	if err != nil {
		t.Errorf("PRAGMA foreign_keys=ON: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE Foo (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		value INTEGER NOT NULL,
		ref INTEGER NULL REFERENCES Foo (id),
		UNIQUE(value)
	);`)
	if err != nil {
		t.Error(err)
	}

	_, err = db.Exec("INSERT INTO Foo (ref, value) VALUES (100, 100);")
	if err == nil {
		t.Error("No error!")
	} else {
		sqliteErr := err.(Error)
		if sqliteErr.Code != ErrConstraint {
			t.Errorf("Wrong basic error code: %d != %d",
				sqliteErr.Code, ErrConstraint)
		}
		if sqliteErr.ExtendedCode != ErrConstraintForeignKey {
			t.Errorf("Wrong extended error code: %d != %d",
				sqliteErr.ExtendedCode, ErrConstraintForeignKey)
		}
	}

}

func TestExtendedErrorCodes_NotNull(t *testing.T) {
	dirName, err := ioutil.TempDir("", "sqlite3-err")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirName)

	dbFileName := path.Join(dirName, "test.db")
	db, err := sql.Open("sqlite3", dbFileName)
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec("PRAGMA foreign_keys=ON;")
	if err != nil {
		t.Errorf("PRAGMA foreign_keys=ON: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE Foo (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		value INTEGER NOT NULL,
		ref INTEGER NULL REFERENCES Foo (id),
		UNIQUE(value)
	);`)
	if err != nil {
		t.Error(err)
	}

	res, err := db.Exec("INSERT INTO Foo (value) VALUES (100);")
	if err != nil {
		t.Fatalf("Creating first row: %v", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("Retrieving last insert id: %v", err)
	}

	_, err = db.Exec("INSERT INTO Foo (ref) VALUES (?);", id)
	if err == nil {
		t.Error("No error!")
	} else {
		sqliteErr := err.(Error)
		if sqliteErr.Code != ErrConstraint {
			t.Errorf("Wrong basic error code: %d != %d",
				sqliteErr.Code, ErrConstraint)
		}
		if sqliteErr.ExtendedCode != ErrConstraintNotNull {
			t.Errorf("Wrong extended error code: %d != %d",
				sqliteErr.ExtendedCode, ErrConstraintNotNull)
		}
	}

}

func TestExtendedErrorCodes_Unique(t *testing.T) {
	dirName, err := ioutil.TempDir("", "sqlite3-err")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirName)

	dbFileName := path.Join(dirName, "test.db")
	db, err := sql.Open("sqlite3", dbFileName)
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec("PRAGMA foreign_keys=ON;")
	if err != nil {
		t.Errorf("PRAGMA foreign_keys=ON: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE Foo (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		value INTEGER NOT NULL,
		ref INTEGER NULL REFERENCES Foo (id),
		UNIQUE(value)
	);`)
	if err != nil {
		t.Error(err)
	}

	res, err := db.Exec("INSERT INTO Foo (value) VALUES (100);")
	if err != nil {
		t.Fatalf("Creating first row: %v", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("Retrieving last insert id: %v", err)
	}

	_, err = db.Exec("INSERT INTO Foo (ref, value) VALUES (?, 100);", id)
	if err == nil {
		t.Error("No error!")
	} else {
		sqliteErr := err.(Error)
		if sqliteErr.Code != ErrConstraint {
			t.Errorf("Wrong basic error code: %d != %d",
				sqliteErr.Code, ErrConstraint)
		}
		if sqliteErr.ExtendedCode != ErrConstraintUnique {
			t.Errorf("Wrong extended error code: %d != %d",
				sqliteErr.ExtendedCode, ErrConstraintUnique)
		}
		extended := sqliteErr.Code.Extend(3).Error()
		expected := "constraint failed"
		if extended != expected {
			t.Errorf("Wrong basic error code: %q != %q",
				extended, expected)
		}
	}

}
