package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type testStorageAlt struct{}

func (t testStorageAlt) ListChannelRules(_ context.Context, cmd ListLiveChannelRuleCommand) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			OrgId:     1,
			Pattern:   "stream/telegraf/cpu",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{}),
		},
		{
			OrgId:   1,
			Pattern: "stream/telegraf/:metric",
		},
		{
			OrgId:   1,
			Pattern: "stream/telegraf/:metric/:extra",
		},
	}, nil
}

func TestStorage_Get(t *testing.T) {
	s := NewCacheSegmentedTree(&testStorageAlt{})
	rule, _, ok, err := s.Get(1, "stream/telegraf/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, rule.Converter)

	rule, ps, ok, err := s.Get(1, "stream/telegraf/mem")
	require.NoError(t, err)
	require.True(t, ok)
	require.Nil(t, rule.Converter)
	val, ok := ps.Get("metric")
	require.True(t, ok)
	require.Equal(t, "mem", val)

	rule, ps, ok, err = s.Get(1, "stream/telegraf/mem/rss")
	require.NoError(t, err)
	require.True(t, ok)
	require.Nil(t, rule.Converter)
	val, ok = ps.Get("metric")
	require.True(t, ok)
	require.Equal(t, "mem", val)
	val, ok = ps.Get("extra")
	require.True(t, ok)
	require.Equal(t, "rss", val)
}

func BenchmarkGetAlt(b *testing.B) {
	s := NewCacheSegmentedTree(&testStorageAlt{})
	for i := 0; i < b.N; i++ {
		_, _, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
