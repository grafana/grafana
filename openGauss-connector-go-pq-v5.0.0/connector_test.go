// +build go1.10

package pq

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"testing"
)

func TestNewConnector_WorksWithOpenDB(t *testing.T) {
	name, err := getTestDsn()
	if err != nil {
		t.Fatal(err)
	}
	c, err := NewConnector(name)
	if err != nil {
		t.Fatal(err)
	}
	db := sql.OpenDB(c)
	defer db.Close()
	// database/sql might not call our Open at all unless we do something with
	// the connection
	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	txn.Rollback()
}

func TestNewConnector_Connect(t *testing.T) {
	name, err := getTestDsn()
	if err != nil {
		t.Fatal(err)
	}
	c, err := NewConnector(name)
	if err != nil {
		t.Fatal(err)
	}
	db, err := c.Connect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// database/sql might not call our Open at all unless we do something with
	// the connection
	txn, err := db.(driver.ConnBeginTx).BeginTx(context.Background(), driver.TxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	txn.Rollback()
}

func TestNewConnector_Driver(t *testing.T) {
	name, err := getTestDsn()
	if err != nil {
		t.Fatal(err)
	}
	c, err := NewConnector(name)
	if err != nil {
		t.Fatal(err)
	}
	db, err := c.Driver().Open(name)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// database/sql might not call our Open at all unless we do something with
	// the connection
	txn, err := db.(driver.ConnBeginTx).BeginTx(context.Background(), driver.TxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	txn.Rollback()
}
