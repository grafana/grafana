package xorm

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

// batchState represents the state of a sequence batch
type batchState struct {
	mu               sync.Mutex
	nextValue        int64
	lastValueInBatch int64
}

type sequenceGenerator struct {
	db             *sql.DB
	sequencesTable string
	batchSize      int64

	mu          sync.Mutex
	batchStates map[string]*batchState // Track sequence batches per key (table:column)
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
	sg.mu.Lock()
	defer sg.mu.Unlock()
	sg.batchStates = make(map[string]*batchState)
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
		start, end, err := sg.allocateNewBatch(ctx, key)
		if err != nil {
			return 0, err
		}
		state.nextValue = start
		state.lastValueInBatch = end
	}

	// Return the next value from the batch
	val := state.nextValue
	state.nextValue++
	return val, nil
}

// allocateNewBatch retrieves a new batch of sequence values from the database.
// It returns the start and end values of the new batch on success.
func (sg *sequenceGenerator) allocateNewBatch(ctx context.Context, key string) (start, end int64, retErr error) {
	tx, err := sg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return 0, 0, err
	}

	defer func() {
		if retErr != nil {
			tx.Rollback()
		}
	}()

	// Query the current sequence value
	rows, err := tx.QueryContext(ctx, "SELECT next_value FROM "+sg.sequencesTable+" WHERE name = ?", key)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()

	// Handle case where sequence doesn't exist yet
	if !rows.Next() {
		if err = rows.Err(); err != nil {
			return 0, 0, err
		}

		// This is a new sequence - start from 1 and allocate a batch
		batchEnd := sg.batchSize
		nextBatchStart := batchEnd + 1

		// Insert the next batch start value
		_, err = tx.ExecContext(ctx,
			"INSERT INTO "+sg.sequencesTable+" (name, next_value) VALUES(?, ?)",
			key, nextBatchStart)
		if err != nil {
			return 0, 0, err
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			return 0, 0, err
		}

		return 1, batchEnd, nil
	}

	// Sequence exists - read current value and allocate next batch
	var batchStart int64
	if err = rows.Scan(&batchStart); err != nil {
		return 0, 0, err
	}

	batchEnd := batchStart + sg.batchSize - 1
	nextBatchStart := batchEnd + 1

	// Update the next batch start value
	_, err = tx.ExecContext(ctx,
		"UPDATE "+sg.sequencesTable+" SET next_value = ? WHERE name = ?",
		nextBatchStart, key)
	if err != nil {
		return 0, 0, err
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return 0, 0, err
	}

	return batchStart, batchEnd, nil
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
