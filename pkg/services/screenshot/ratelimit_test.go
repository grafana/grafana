package screenshot

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenRateLimiter(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	r := NewTokenRateLimiter(1)

	ctx, cancelFunc := context.WithTimeout(context.Background(), time.Second)
	defer cancelFunc()

	var (
		v  int64
		wg sync.WaitGroup
	)

	testScreenshotFunc := func(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error) {
		// v should be 1 to show that no other goroutines acquired the token
		atomic.AddInt64(&v, 1)
		assert.Equal(t, int64(1), atomic.LoadInt64(&v))

		// interrupt so other goroutines can attempt to acquire the token
		<-time.After(time.Microsecond)

		// v should be 0
		atomic.AddInt64(&v, -1)
		assert.Equal(t, int64(0), atomic.LoadInt64(&v))

		return &Screenshot{}, nil
	}

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			screenshot, err := r.Do(ctx, ScreenshotOptions{}, testScreenshotFunc)
			require.NoError(t, err)
			assert.NotNil(t, screenshot)
		}()
	}
	wg.Wait()
}
