package responsesize

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecorder(t *testing.T) {
	assert.Nil(t, FromContext(context.Background()))
	ctx, r := WithRecorder(context.Background())
	require.Same(t, r, FromContext(ctx))

	r.Add("A", 10)
	r.Add("B", 5)
	r.Add("A", 7)
	sizes := r.Sizes()
	sizes["A"] = 999

	assert.Equal(t, map[string]int64{"A": 17, "B": 5}, r.Sizes(), "sizes add up per refID, and Sizes returns a copy")
}

func TestNilRecorderIgnoresEverything(t *testing.T) {
	var r *Recorder

	r.Add("A", 1)

	assert.Nil(t, r.Sizes())
}

func TestRecorderIsSafeForConcurrentUse(t *testing.T) {
	_, r := WithRecorder(context.Background())

	var wg sync.WaitGroup
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.Add("A", 2)
			_ = r.Sizes()
		}()
	}
	wg.Wait()

	assert.Equal(t, map[string]int64{"A": 100}, r.Sizes())
}
