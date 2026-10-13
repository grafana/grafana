package models

import (
	"testing"
	"testing/synctest"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImage_ExtendDuration(t *testing.T) {
	var i Image
	d := time.Now().Add(time.Minute)
	i.ExpiresAt = d
	// extend the duration for 1 minute
	i.ExtendDuration(time.Minute)
	assert.Equal(t, d.Add(time.Minute), i.ExpiresAt)
	// can shorten the duration too
	i.ExtendDuration(-time.Minute)
	assert.Equal(t, d, i.ExpiresAt)
}

func TestImageCaptureResult(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		capture, complete := NewImageCapture()
		_, err, done := capture.Result()
		require.NoError(t, err)
		require.False(t, done)
		require.True(t, capture.CompletedAt().IsZero())
		image := Image{Token: "token", Path: "screenshot.png"}
		completedAt := time.Now()
		go complete(image, nil, completedAt)
		synctest.Wait()
		for range 2 {
			got, err, done := capture.Result()
			require.True(t, done)
			require.NoError(t, err)
			require.Equal(t, image, got)
			require.Equal(t, completedAt, capture.CompletedAt())
			got.Path = "modified.png"
		}
	})
}

func TestImage_HasExpired(t *testing.T) {
	oldTimeNow := timeNow
	timeNow = clock.NewMock().Now
	t.Cleanup(func() {
		timeNow = oldTimeNow
	})

	var i Image
	i.ExpiresAt = timeNow().Add(time.Minute)
	assert.False(t, i.HasExpired())
	i.ExpiresAt = timeNow()
	assert.False(t, i.HasExpired())
	i.ExpiresAt = timeNow().Add(-time.Minute)
	assert.True(t, i.HasExpired())
}

func TestImage_HasPath(t *testing.T) {
	var i Image
	assert.False(t, i.HasPath())
	i.Path = "/"
	assert.True(t, i.HasPath())
	i.Path = "/tmp/image.png"
	assert.True(t, i.HasPath())
}

func TestImage_HasURL(t *testing.T) {
	var i Image
	assert.False(t, i.HasURL())
	i.URL = "/"
	assert.True(t, i.HasURL())
	i.URL = "https://example.com/image.png"
	assert.True(t, i.HasURL())
}
