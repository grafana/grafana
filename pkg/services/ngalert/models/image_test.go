package models

import (
	"fmt"
	"os"
	"path"
	"testing"
	"time"

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

func TestImage_HasExpired(t *testing.T) {
	var i Image
	i.ExpiresAt = time.Now().Add(time.Minute)
	assert.False(t, i.HasExpired())
	i.ExpiresAt = time.Now()
	assert.True(t, i.HasExpired())
	i.ExpiresAt = time.Now().Add(-time.Minute)
	assert.True(t, i.HasExpired())
}

func TestImage_HasFileOnDisk(t *testing.T) {
	var i Image

	// the file should not exist
	i.Path = path.Join(t.TempDir(), "image.png")
	exists, err := i.HasFileOnDisk()
	assert.NoError(t, err)
	assert.False(t, exists)

	// create the file
	_, err = os.Create(i.Path)
	require.NoError(t, err)
	exists, err = i.HasFileOnDisk()
	assert.NoError(t, err)
	assert.True(t, exists)

	// create a dir
	i.Path = path.Join(t.TempDir(), "dir")
	require.NoError(t, os.Mkdir(i.Path, 0750))
	exists, err = i.HasFileOnDisk()
	assert.EqualError(t, err, fmt.Sprintf("%s is a dir", i.Path))
	assert.False(t, exists)
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
