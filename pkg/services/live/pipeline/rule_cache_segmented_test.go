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
	rule, ok, err := s.Get(1, "stream/telegraf/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, rule.Converter)

	rule, ok, err = s.Get(1, "stream/telegraf/mem")
	require.NoError(t, err)
	require.True(t, ok)
	require.Nil(t, rule.Converter)

	rule, ok, err = s.Get(1, "stream/telegraf/mem/rss")
	require.NoError(t, err)
	require.True(t, ok)
	require.Nil(t, rule.Converter)
}

func BenchmarkRuleGet(b *testing.B) {
	s := NewCacheSegmentedTree(&testStorageAlt{})
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
