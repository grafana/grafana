package log

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCountingDatabaseCalls(t *testing.T) {
	ctx := context.Background()

	ctx = IncDBCallCounter(ctx)
	ctx = IncDBCallCounter(ctx)
	ctx = IncDBCallCounter(ctx)

	count := TotalDBCallCount(ctx)
	assert.Equal(t, int64(3), count, "expect counter to increase three times")
}
