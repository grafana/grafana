package managedstream

import (
	"testing"
	"time"

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

func TestManagedStreamMinuteRate(t *testing.T) {
	publisher := &testPublisher{orgID: 1, t: t}
	c := NewManagedStream("a", publisher.publish, NewMemoryFrameCache())
	require.NotNil(t, c)

	c.incRate("test1", time.Now().Unix())
	require.Equal(t, int64(1), c.minuteRate("test1"))
	require.Equal(t, int64(0), c.minuteRate("test2"))
	c.incRate("test1", time.Now().Unix())
	require.Equal(t, int64(2), c.minuteRate("test1"))

	nowUnix := time.Now().Unix()
	for i := 0; i < 1000; i++ {
		unixTime := nowUnix + int64(i)
		c.incRate("test3", unixTime)
	}
	require.Equal(t, int64(60), c.minuteRate("test3"))

	c.incRate("test3", nowUnix+999)
	require.Equal(t, int64(61), c.minuteRate("test3"))
}
