package channelrule

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStorage_Get(t *testing.T) {
	s := NewCache(Fixtures)
	c, ok, err := s.Get(1, "stream/telegraf/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), c.OrgId)

	_, ok, err = s.Get(1, "streams/telegraf/cpu")
	require.NoError(t, err)
	require.False(t, ok)
}

func BenchmarkGet(b *testing.B) {
	s := NewCache(Fixtures)
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
