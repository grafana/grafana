package xorm

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
)

// batchState represents the state of a sequence batch
type batchState struct {
	nextValue        int64
	lastValueInBatch int64
	mu               sync.Mutex
}

type sequenceGenerator struct {
	db             *sql.DB
	sequencesTable string
	batchSize      int64

	// Track sequence batches per key (table:column)
	batchStates map[string]*batchState
	mu          sync.Mutex
}

func newSequenceGenerator(db *sql.DB) *sequenceGenerator {
	return &sequenceGenerator{
		db:             db,
		sequencesTable: "autoincrement_sequences",
		batchSize:      100, // Default batch size
		batchStates:    make(map[string]*batchState),
	}
}

func (sg *sequenceGenerator) Reset() {
	// Nothing to do. This generator always uses state from DB.
}

func (sg *sequenceGenerator) Next(ctx context.Context, table, column string) (int64, error) {
	key := fmt.Sprintf("%s:%s", table, column)

	// First get or create the state with a global lock (only for map access)
	sg.mu.Lock()
	state, exists := sg.batchStates[key]
	if !exists {
		state = &batchState{
			nextValue:        0,
			lastValueInBatch: -1,
		}
		sg.batchStates[key] = state
	}
	sg.mu.Unlock() // Release global lock as soon as possible

	// Now lock only the specific sequence state
	state.mu.Lock()
	defer state.mu.Unlock()

	// If we've used all values in the current batch, get a new batch
	if state.nextValue > state.lastValueInBatch {
		if err := sg.getBatch(ctx, key, state); err != nil {
			return 0, err
		}
	}

	// Return the next value from the batch
	val := state.nextValue
	state.nextValue++
	return val, nil
}

func (sg *sequenceGenerator) getBatch(ctx context.Context, key string, state *batchState) error {
	tx, err := sg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}

	// TODO: "FOR UPDATE". (Somehow this doesn't seem to be supported in Spanner emulator?)
	r, err := tx.QueryContext(ctx, "SELECT next_value FROM "+sg.sequencesTable+" WHERE name = ?", key)
	if err != nil {
		err2 := tx.Rollback()
		return errors.Join(err, err2)
	}
	defer r.Close()

	// Sequence doesn't exist yet. Return 1, and put batch size + 1 into the table.
	if !r.Next() {
		if err := r.Err(); err != nil {
			return errors.Join(err, tx.Rollback())
		}

		// Start with 1 and allocate a batch
		state.nextValue = 1
		state.lastValueInBatch = sg.batchSize

		// Insert the next batch start value (batchSize + 1)
		_, err := tx.ExecContext(ctx, "INSERT INTO "+sg.sequencesTable+" (name, next_value) VALUES(?, ?)", key, sg.batchSize+1)
		if err != nil {
			return errors.Join(err, tx.Rollback())
		}

		return tx.Commit()
	}

	var nextBatchStart int64
	if err := r.Scan(&nextBatchStart); err != nil {
		return errors.Join(err, tx.Rollback())
	}

	// Update the next batch start value in the database
	_, err = tx.ExecContext(ctx, "UPDATE "+sg.sequencesTable+" SET next_value = ? WHERE name = ?", nextBatchStart+sg.batchSize, key)
	if err != nil {
		return errors.Join(err, tx.Rollback())
	}

	// Set our current batch range
	state.nextValue = nextBatchStart
	state.lastValueInBatch = nextBatchStart + sg.batchSize - 1

	return tx.Commit()
}

// SetBatchSize allows changing the batch size
func (sg *sequenceGenerator) SetBatchSize(size int64) {
	sg.mu.Lock()
	defer sg.mu.Unlock()
	sg.batchSize = size
}

func (sg *sequenceGenerator) close() {
	// Nothing to do just yet.
}
