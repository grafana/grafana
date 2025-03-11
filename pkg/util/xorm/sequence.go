package xorm

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type sequenceGenerator struct {
	db             *sql.DB
	sequencesTable string
}

func newSequenceGenerator(db *sql.DB) *sequenceGenerator {
	return &sequenceGenerator{
		db:             db,
		sequencesTable: "autoincrement_sequences",
	}
}

func (sg *sequenceGenerator) Next(ctx context.Context, table, column string) (int64, error) {
	// Current implementation fetches new value for each Next call.
	key := fmt.Sprintf("%s:%s", table, column)

	tx, err := sg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return 0, err
	}

	// TODO: "FOR UPDATE". (Somehow this doesn't seem to be supported in Spanner emulator?)
	r, err := tx.QueryContext(ctx, "SELECT next_value FROM "+sg.sequencesTable+" WHERE name = ?", key)
	if err != nil {
		err2 := tx.Rollback()
		return 0, errors.Join(err, err2)
	}
	defer r.Close()

	// Sequence doesn't exist yet. Return 1, and put 2 into the table.
	if !r.Next() {
		if err := r.Err(); err != nil {
			return 0, errors.Join(err, tx.Rollback())
		}
		val := int64(1)

		_, err := tx.ExecContext(ctx, "INSERT INTO "+sg.sequencesTable+" (name, next_value) VALUES(?, ?)", key, val+1)
		if err != nil {
			return 0, errors.Join(err, tx.Rollback())
		}

		return val, tx.Commit()
	}

	var val int64
	if err := r.Scan(&val); err != nil {
		return 0, errors.Join(err, tx.Rollback())
	}

	_, err = tx.ExecContext(ctx, "UPDATE "+sg.sequencesTable+" SET next_value = ? WHERE name = ?", val+1, key)
	if err != nil {
		return 0, errors.Join(err, tx.Rollback())
	}

	return val, tx.Commit()
}

func (sg *sequenceGenerator) close() {
	// Nothing to do just yet.
}
