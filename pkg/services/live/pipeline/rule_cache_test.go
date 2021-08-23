package pipeline

import (
	"context"
	"testing"
)

type testStorage struct{}

func (t testStorage) ListChannelRules(_ context.Context, cmd ListLiveChannelRuleCommand) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			OrgId:     1,
			Pattern:   "stream/telegraf/cpu",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{}),
		},
		{
			OrgId:   1,
			Pattern: "stream/telegraf/*",
		},
	}, nil
}

func BenchmarkGet(b *testing.B) {
	s := NewCache(&testStorage{})
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
