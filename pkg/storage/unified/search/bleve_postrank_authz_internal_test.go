package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPostRankAuthzConfigWindowSize(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 10000}.effective()
	assert.Equal(t, 500, cfg.windowSize(100))
	assert.Equal(t, 5000, cfg.windowSize(1000))
	// Clamped to MaxWindow.
	assert.Equal(t, 10000, cfg.windowSize(100000))
}

func TestPostRankAuthzConfigGrowWindow(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 1, MaxWindow: 40}.effective()
	base := cfg.windowSize(10) // 10

	// First window is the base; each subsequent window doubles.
	assert.Equal(t, 10, cfg.growWindow(base, 0))
	assert.Equal(t, 20, cfg.growWindow(base, 1))
	assert.Equal(t, 40, cfg.growWindow(base, 2))
	// Growth saturates at MaxWindow and stays there.
	assert.Equal(t, 40, cfg.growWindow(base, 3))
	assert.Equal(t, 40, cfg.growWindow(base, 99))

	// When the base already equals MaxWindow, growth is a no-op.
	flat := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 100}.effective()
	fb := flat.windowSize(1000) // clamped to 100
	assert.Equal(t, 100, flat.growWindow(fb, 5))
}
