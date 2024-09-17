package ssosettingstests

import context "context"

type FakeFallbackStrategy struct {
	ExpectedIsMatch bool
	ExpectedConfigs map[string]map[string]any

	ExpectedError error
}

func NewFakeFallbackStrategy() *FakeFallbackStrategy {
	return &FakeFallbackStrategy{}
}

func (f *FakeFallbackStrategy) IsMatch(provider string) bool {
	return f.ExpectedIsMatch
}

func (f *FakeFallbackStrategy) GetProviderConfig(ctx context.Context, provider string) (map[string]any, error) {
	return f.ExpectedConfigs[provider], f.ExpectedError
}
