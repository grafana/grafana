package live

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

var noopPublisher = func(p string, b []byte) error {
	return nil
}

func TestNewCache(t *testing.T) {
	c := NewManagedStream("a", noopPublisher)
	require.NotNil(t, c)
}

func TestCache_Get(t *testing.T) {
	c := NewManagedStream("a", noopPublisher)
	_, ok := c.GetLastPacket("test")
	require.False(t, ok)
	err := c.Push("test", data.NewFrame("hello"))
	require.NoError(t, err)

	s, ok := c.GetLastPacket("test")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, `{"schema":{"name":"hello","fields":[]},"data":{"values":[]}}`, string(s))
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
