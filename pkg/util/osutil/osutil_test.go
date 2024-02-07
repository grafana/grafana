package osutil

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRealEnv(t *testing.T) {
	// testing here is obviously not parallel since we do need to access real
	// environment variables from the os

	const key = "MEREKETENGUE"
	const value = "IS ALIVE"

	assert.Equal(t, os.Getenv(key), RealEnv{}.Getenv(key))
	assert.NoError(t, RealEnv{}.Setenv(key, value))
	assert.Equal(t, value, RealEnv{}.Getenv(key))
	assert.Equal(t, value, os.Getenv(key))
}

func TestMapEnv(t *testing.T) {
	t.Parallel()

	const key = "THE_THING"
	const value = "IS ALIVE"

	e := MapEnv{}
	assert.Empty(t, e.Getenv(key))
	assert.Len(t, e, 0)
	assert.NoError(t, e.Setenv(key, value))
	assert.Equal(t, value, e.Getenv(key))
	assert.Len(t, e, 1)
}
