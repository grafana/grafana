// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package core

import (
	"context"
	"database/sql"
)

type Tx struct {
	*sql.Tx
	db *DB
}

func (db *DB) BeginTx(ctx context.Context, opts *sql.TxOptions) (*Tx, error) {
	tx, err := db.DB.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &Tx{tx, db}, nil
}

func (db *DB) Begin() (*Tx, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return nil, err
	}
	return &Tx{tx, db}, nil
}

func (tx *Tx) PrepareContext(ctx context.Context, query string) (*Stmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := tx.Tx.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &Stmt{stmt, tx.db, names}, nil
}

func (tx *Tx) Prepare(query string) (*Stmt, error) {
	return tx.PrepareContext(context.Background(), query)
}

func (tx *Tx) StmtContext(ctx context.Context, stmt *Stmt) *Stmt {
	stmt.Stmt = tx.Tx.StmtContext(ctx, stmt.Stmt)
	return stmt
}

func (tx *Tx) Stmt(stmt *Stmt) *Stmt {
	return tx.StmtContext(context.Background(), stmt)
}

func (tx *Tx) ExecMapContext(ctx context.Context, query string, mp interface{}) (sql.Result, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.Tx.ExecContext(ctx, query, args...)
}

func (tx *Tx) ExecMap(query string, mp interface{}) (sql.Result, error) {
	return tx.ExecMapContext(context.Background(), query, mp)
}

func (tx *Tx) ExecStructContext(ctx context.Context, query string, st interface{}) (sql.Result, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.Tx.ExecContext(ctx, query, args...)
}

func (tx *Tx) ExecStruct(query string, st interface{}) (sql.Result, error) {
	return tx.ExecStructContext(context.Background(), query, st)
}

func (tx *Tx) QueryContext(ctx context.Context, query string, args ...interface{}) (*Rows, error) {
	rows, err := tx.Tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return &Rows{rows, tx.db}, nil
}

func (tx *Tx) Query(query string, args ...interface{}) (*Rows, error) {
	return tx.QueryContext(context.Background(), query, args...)
}

func (tx *Tx) QueryMapContext(ctx context.Context, query string, mp interface{}) (*Rows, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.QueryContext(ctx, query, args...)
}

func (tx *Tx) QueryMap(query string, mp interface{}) (*Rows, error) {
	return tx.QueryMapContext(context.Background(), query, mp)
}

func (tx *Tx) QueryStructContext(ctx context.Context, query string, st interface{}) (*Rows, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.QueryContext(ctx, query, args...)
}

func (tx *Tx) QueryStruct(query string, st interface{}) (*Rows, error) {
	return tx.QueryStructContext(context.Background(), query, st)
}

func (tx *Tx) QueryRowContext(ctx context.Context, query string, args ...interface{}) *Row {
	rows, err := tx.QueryContext(ctx, query, args...)
	return &Row{rows, err}
}

func (tx *Tx) QueryRow(query string, args ...interface{}) *Row {
	return tx.QueryRowContext(context.Background(), query, args...)
}

func (tx *Tx) QueryRowMapContext(ctx context.Context, query string, mp interface{}) *Row {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return &Row{nil, err}
	}
	return tx.QueryRowContext(ctx, query, args...)
}

func (tx *Tx) QueryRowMap(query string, mp interface{}) *Row {
	return tx.QueryRowMapContext(context.Background(), query, mp)
}

func (tx *Tx) QueryRowStructContext(ctx context.Context, query string, st interface{}) *Row {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return &Row{nil, err}
	}
	return tx.QueryRowContext(ctx, query, args...)
}

func (tx *Tx) QueryRowStruct(query string, st interface{}) *Row {
	return tx.QueryRowStructContext(context.Background(), query, st)
}
