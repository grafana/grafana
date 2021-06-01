package managedstream

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

type testPublisher struct {
	orgID int64
	t     *testing.T
}

func (p *testPublisher) publish(orgID int64, _ string, _ []byte) error {
	require.Equal(p.t, p.orgID, orgID)
	return nil
}

func TestNewManagedStream(t *testing.T) {
	publisher := &testPublisher{orgID: 1, t: t}
	c := NewManagedStream("a", publisher.publish, NewMemoryFrameCache())
	require.NotNil(t, c)
}

func TestManagedStream_GetLastPacket(t *testing.T) {
	var orgID int64 = 1
	publisher := &testPublisher{orgID: orgID, t: t}
	c := NewManagedStream("a", publisher.publish, NewMemoryFrameCache())
	_, ok, err := c.frameCache.GetFrame(orgID, "stream/a/test")
	require.NoError(t, err)
	require.False(t, ok)
	err = c.Push(orgID, "test", data.NewFrame("hello"))
	require.NoError(t, err)

	s, ok, err := c.frameCache.GetFrame(orgID, "stream/a/test")
	require.NoError(t, err)
	require.True(t, ok)
	require.JSONEq(t, `{"schema":{"name":"hello","fields":[]},"data":{"values":[]}}`, string(s))
}
