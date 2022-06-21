package managedstream

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

type testPublisher struct {
	t *testing.T
}

func (p *testPublisher) publish(_ int64, _ string, _ []byte) error {
	return nil
}

func TestNewManagedStream(t *testing.T) {
	publisher := &testPublisher{t: t}
	c := NewNamespaceStream(1, "stream", "a", publisher.publish, nil, NewMemoryFrameCache())
	require.NotNil(t, c)
}

func TestManagedStreamMinuteRate(t *testing.T) {
	publisher := &testPublisher{t: t}
	c := NewNamespaceStream(1, "stream", "a", publisher.publish, nil, NewMemoryFrameCache())
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

func TestGetManagedStreams(t *testing.T) {
	publisher := &testPublisher{t: t}
	frameCache := NewMemoryFrameCache()
	runner := NewRunner(publisher.publish, nil, frameCache)
	s1, err := runner.GetOrCreateStream(1, "stream", "test1")
	require.NoError(t, err)
	s2, err := runner.GetOrCreateStream(1, "stream", "test2")
	require.NoError(t, err)

	managedChannels, err := runner.GetManagedChannels(1)
	require.NoError(t, err)
	require.Len(t, managedChannels, 4) // 4 hardcoded testdata streams.

	err = s1.Push(context.Background(), "cpu1", data.NewFrame("cpu1"))
	require.NoError(t, err)

	err = s1.Push(context.Background(), "cpu2", data.NewFrame("cpu2"))
	require.NoError(t, err)

	err = s2.Push(context.Background(), "cpu1", data.NewFrame("cpu1"))
	require.NoError(t, err)

	managedChannels, err = runner.GetManagedChannels(1)
	require.NoError(t, err)
	require.Len(t, managedChannels, 7) // 4 hardcoded testdata streams + 3 test channels.
	require.Equal(t, "stream/test1/cpu1", managedChannels[4].Channel)
	require.Equal(t, "stream/test1/cpu2", managedChannels[5].Channel)
	require.Equal(t, "stream/test2/cpu1", managedChannels[6].Channel)

	// Different org.
	s3, err := runner.GetOrCreateStream(2, "stream", "test1")
	require.NoError(t, err)
	err = s3.Push(context.Background(), "cpu1", data.NewFrame("cpu1"))
	require.NoError(t, err)
	managedChannels, err = runner.GetManagedChannels(1)
	require.NoError(t, err)
	require.Len(t, managedChannels, 7) // Not affected by other org.
}
