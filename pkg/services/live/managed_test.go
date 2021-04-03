package live

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestNewCache(t *testing.T) {
	c := NewManagedStream("a")
	require.NotNil(t, c)
}

func TestCache_Get(t *testing.T) {
	c := NewManagedStream("a")
	_, ok := c.GetSchema("test")
	require.False(t, ok)
	res, err := c.Push("test", data.NewFrame("hello"))
	require.NoError(t, err)
	require.Equal(t, "stream/a/test", res.Channel)

	s, ok := c.GetSchema("test")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, `{"schema":{"name":"hello","fields":[]}}`, string(s))
}

// func TestCache_Delete(t *testing.T) {
// 	c := NewManagedStream("a")
// 	err := c.Update("test", []byte(`{}`))
// 	require.NoError(t, err)
// 	_, ok, err := c.Get("test")
// 	require.NoError(t, err)
// 	require.True(t, ok)
// 	err = c.Delete("test")
// 	require.NoError(t, err)
// 	_, ok, err = c.Get("test")
// 	require.NoError(t, err)
// 	require.False(t, ok)
// }
