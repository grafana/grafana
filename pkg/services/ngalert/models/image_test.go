package models

import (
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/assert"
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
