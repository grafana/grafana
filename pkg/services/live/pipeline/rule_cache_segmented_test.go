package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type testBuilder struct{}

func (t *testBuilder) BuildRules(_ context.Context, _ int64) ([]*LiveChannelRule, error) {
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
			OrgId:     1,
			Pattern:   "stream/telegraf/:metric/:extra",
			Outputter: NewRedirectOutput(RedirectOutputConfig{}),
		},
		{
			OrgId:     1,
			Pattern:   "stream/boom:er",
			Converter: NewExactJsonConverter(ExactJsonConverterConfig{}),
		},
	}, nil
}

func TestStorage_Get(t *testing.T) {
	s := NewCacheSegmentedTree(&testBuilder{})
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
	require.Equal(t, OutputTypeRedirect, rule.Outputter.Type())

	rule, ok, err = s.Get(1, "stream/booms")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, ConverterTypeJsonExact, rule.Converter.Type())
}

func BenchmarkRuleGet(b *testing.B) {
	s := NewCacheSegmentedTree(&testBuilder{})
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
