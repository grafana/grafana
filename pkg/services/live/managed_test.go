package live

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

var noopPublisher = func(p string, b []byte) error {
	return nil
}

func TestNewManagedStream(t *testing.T) {
	c := NewManagedStream("a", noopPublisher)
	require.NotNil(t, c)
}

func TestManagedStream_GetLastPacket(t *testing.T) {
	c := NewManagedStream("a", noopPublisher)
	_, ok := c.getLastPacket("test")
	require.False(t, ok)
	err := c.Push("test", data.NewFrame("hello"))
	require.NoError(t, err)

	s, ok := c.getLastPacket("test")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, `{"schema":{"name":"hello","fields":[]},"data":{"values":[]}}`, string(s))
}
