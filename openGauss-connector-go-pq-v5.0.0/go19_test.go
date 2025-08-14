//go:build go1.9
// +build go1.9

package pq

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"reflect"
	"testing"
)

func TestPing(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	db := openTestConn(t)
	defer db.Close()

	if _, ok := reflect.TypeOf(db).MethodByName("Conn"); !ok {
		t.Skipf("Conn method undefined on type %T, skipping test (requires at least go1.9)", db)
	}

	if err := db.PingContext(ctx); err != nil {
		t.Fatal("expected Ping to succeed")
	}
	defer cancel()

	// grab a connection
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// start a transaction and read backend pid of our connection
	tx, err := conn.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelDefault,
		ReadOnly:  true,
	})
	if err != nil {
		t.Fatal(err)
	}

	rows, err := tx.Query("SELECT pg_backend_pid(),pg_current_sessid()")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	// read the pid from result
	var (
		pid       int
		sessionId int
	)
	for rows.Next() {
		if err := rows.Scan(&pid, &sessionId); err != nil {
			t.Fatal(err)
		}
	}
	if rows.Err() != nil {
		t.Fatal(err)
	}
	// Fail the transaction and make sure we can still ping.
	if _, err := tx.Query("INVALID SQL"); err == nil {
		t.Fatal("expected error")
	}
	if err := conn.PingContext(ctx); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}

	// kill the process which handles our connection and test if the ping fails
	if _, err := db.Exec("SELECT pg_terminate_session($1,$2)", pid, sessionId); err != nil {
		t.Fatal(err)
	}
	var i int64
	if err := conn.QueryRowContext(ctx, "select 1").Scan(&i); err != driver.ErrBadConn {
		t.Fatalf("expected error %s, instead got %s", driver.ErrBadConn, err)
	}
}

func TestCommitInFailedTransactionWithCancelContext(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	txn, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := txn.Query("SELECT error")
	if err == nil {
		rows.Close()
		t.Fatal("expected failure")
	}
	err = txn.Commit()
	if err != ErrInFailedTransaction {
		t.Fatalf("expected ErrInFailedTransaction; got %#v", err)
	}
}
