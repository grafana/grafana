package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type testBuilder struct{}

func (t *testBuilder) BuildRules(_ context.Context, _ string) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			Namespace: "default",
			Pattern:   "stream/telegraf/cpu",
		},
		{
			Namespace: "default",
			Pattern:   "stream/telegraf/:metric",
		},
		{
			Namespace: "default",
			Pattern:   "stream/telegraf/:metric/:extra",
		},
		{
			Namespace: "default",
			Pattern:   "stream/boom:er",
		},
	}, nil
}

func TestStorage_Get(t *testing.T) {
	s := NewCacheSegmentedTree(&testBuilder{})
	rule, ok, err := s.Get("default", "stream/telegraf/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "stream/telegraf/cpu", rule.Pattern)

	rule, ok, err = s.Get("default", "stream/telegraf/mem")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "stream/telegraf/:metric", rule.Pattern)

	rule, ok, err = s.Get("default", "stream/telegraf/mem/rss")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "stream/telegraf/:metric/:extra", rule.Pattern)

	rule, ok, err = s.Get("default", "stream/booms")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "stream/boom:er", rule.Pattern)
}

func BenchmarkRuleGet(b *testing.B) {
	s := NewCacheSegmentedTree(&testBuilder{})
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get("default", "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
