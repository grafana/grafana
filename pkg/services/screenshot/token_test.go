package screenshot

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

func TestFixedTokenBucket(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	s := NewFixedTokenBucket(1)
	ctx, cancelFunc := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelFunc()

	var (
		v  int64
		wg sync.WaitGroup
	)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// acquire a token
			token, err := s.Get(ctx)
			assert.NoError(t, err)
			assert.True(t, token)

			// v should be 1 to show that no other goroutines acquired the token
			atomic.AddInt64(&v, 1)
			assert.Equal(t, int64(1), atomic.LoadInt64(&v))

			// interrupt so other goroutines can attempt to acquire the token
			<-time.After(time.Microsecond)

			// v should be 0
			atomic.AddInt64(&v, -1)
			assert.Equal(t, int64(0), atomic.LoadInt64(&v))

			// return the token
			s.Done()
		}()
	}
	wg.Wait()
}
