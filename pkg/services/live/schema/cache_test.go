package schema

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewCache(t *testing.T) {
	c := NewCache()
	require.NotNil(t, c)
}

func TestCache_Update(t *testing.T) {
	c := NewCache()
	err := c.Update("test", []byte(`{}`))
	require.NoError(t, err)
}

func TestCache_Get(t *testing.T) {
	c := NewCache()
	_, ok, err := c.Get("test")
	require.NoError(t, err)
	require.False(t, ok)
	err = c.Update("test", []byte(`{}`))
	require.NoError(t, err)
	s, ok, err := c.Get("test")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, json.RawMessage(`{}`), s)
}

func TestCache_Delete(t *testing.T) {
	c := NewCache()
	err := c.Update("test", []byte(`{}`))
	require.NoError(t, err)
	_, ok, err := c.Get("test")
	require.NoError(t, err)
	require.True(t, ok)
	err = c.Delete("test")
	require.NoError(t, err)
	_, ok, err = c.Get("test")
	require.NoError(t, err)
	require.False(t, ok)
}
