package xorm

import (
	"context"
	"fmt"
	"math/rand/v2"
	"sync"
)

type inMemSequenceGenerator struct {
	sequencesMu sync.Mutex
	nextValues  map[string]int
}

func newInMemSequenceGenerator() *inMemSequenceGenerator {
	return &inMemSequenceGenerator{
		nextValues: make(map[string]int),
	}
}

func (g *inMemSequenceGenerator) Reset() {
	g.sequencesMu.Lock()
	defer g.sequencesMu.Unlock()

	g.nextValues = make(map[string]int)
}

func (g *inMemSequenceGenerator) Next(_ context.Context, table, column string) (int64, error) {
	if table == "migration_log" {
		// Don't use sequential IDs for migration log entries, as we don't clean up migration_log table between tests,
		// so restarting the sequence can lead to conflicting IDs.
		return rand.Int64(), nil
	}

	key := fmt.Sprintf("%s:%s", table, column)

	g.sequencesMu.Lock()
	defer g.sequencesMu.Unlock()

	seq, ok := g.nextValues[key]
	if !ok {
		seq = 1
	}
	g.nextValues[key] = seq + 1
	return int64(seq), nil
}
