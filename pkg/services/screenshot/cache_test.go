package screenshot

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInmemCacheService(t *testing.T) {
	s := NewInmemCacheService(time.Second, prometheus.DefaultRegisterer)
	ctx := context.Background()
	opts := ScreenshotOptions{DashboardUID: "foo", PanelID: 1}

	// should be a miss
	actual, ok := s.Get(ctx, opts)
	assert.False(t, ok)
	assert.Nil(t, actual)

	// should be a hit
	expected := Screenshot{Path: "panel.png"}
	require.NoError(t, s.Set(ctx, opts, &expected))
	actual, ok = s.Get(ctx, opts)
	assert.True(t, ok)
	assert.Equal(t, expected, *actual)

	// wait 1s and the cached screenshot should have expired
	<-time.After(time.Second)

	// should be a miss
	actual, ok = s.Get(ctx, opts)
	assert.False(t, ok)
	assert.Nil(t, actual)
}
