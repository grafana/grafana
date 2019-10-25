// +build integration

package serverlock

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestServerLok(t *testing.T) {
	sl := createTestableServerLock(t)

	counter := 0
	fn := func() { counter++ }
	atInterval := time.Second * 1
	ctx := context.Background()

	//this time `fn` should be executed
	assert.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))

	//this should not execute `fn`
	assert.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	assert.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))

	// wait 2 second.
	<-time.After(time.Second * 2)

	// now `fn` should be executed again
	err := sl.LockAndExecute(ctx, "test-operation", atInterval, fn)
	assert.Nil(t, err)
	assert.Equal(t, counter, 2)
}
