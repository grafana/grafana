package screenshot

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSingleFlighter struct {
	i    uint64
	impl SingleFlight
}

func (s *mockSingleFlighter) Do(ctx context.Context, opts ScreenshotOptions, fn captureFunc) (*Screenshot, error) {
	atomic.AddUint64(&s.i, 1)
	return s.impl.Do(ctx, opts, fn)
}

func TestManagedScreenshotService(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "test", PanelID: 1}
	screenshot := Screenshot{Path: "test.png"}

	// set up mock expectations
	cs := NewMockCaptureService(ctrl)
	cs.EXPECT().Screenshot(ctx, opts).Return(&screenshot, nil)
	// Can't use NewMockSingleFlight because captureFunc is not comparable
	sf := mockSingleFlighter{impl: NewSingleFlight()}
	tb := NewMockTokenBucket(ctrl)
	// expect a token to be acquired and then returned
	tb.EXPECT().Get(ctx).Return(true, nil)
	tb.EXPECT().Done()
	ch := NewMockCacheService(ctrl)
	// expect a cache miss
	ch.EXPECT().Get(ctx, opts).Return(nil, false)
	// and then write back to the cache
	ch.EXPECT().Set(ctx, opts, &screenshot).Return(nil)

	s := NewManagedScreenshotService(cs, &sf, tb, ch, prometheus.DefaultRegisterer)
	result, err := s.Take(ctx, opts)
	require.NoError(t, err)
	assert.NotNil(t, result)

	// assert that SingleFlight was called
	assert.Equal(t, uint64(1), atomic.LoadUint64(&sf.i))
}

func TestNoOpScreenshotService(t *testing.T) {
	s := NoOpScreenshotService{}
	screenshot, err := s.Take(context.Background(), ScreenshotOptions{})
	assert.NoError(t, err)
	assert.NotNil(t, screenshot)
}

func TestScreenshotUnavailableService(t *testing.T) {
	s := ScreenshotUnavailableService{}
	screenshot, err := s.Take(context.Background(), ScreenshotOptions{})
	assert.Equal(t, err, ErrScreenshotsUnavailable)
	assert.Nil(t, screenshot)
}
