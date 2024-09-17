package image

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestInmemCacheService(t *testing.T) {
	s := NewInmemCacheService(time.Second, prometheus.DefaultRegisterer)
	ctx := context.Background()

	// should be a miss
	actual, ok := s.Get(ctx, "test")
	assert.False(t, ok)
	assert.Equal(t, models.Image{}, actual)

	// should be a hit
	expected := models.Image{Path: "test.png"}
	require.NoError(t, s.Set(ctx, "test", expected))
	actual, ok = s.Get(ctx, "test")
	assert.True(t, ok)
	assert.Equal(t, expected, actual)

	// wait 1s and the cached image should have expired
	<-time.After(time.Second)

	// should be a miss
	actual, ok = s.Get(ctx, "test")
	assert.False(t, ok)
	assert.Equal(t, models.Image{}, actual)
}
