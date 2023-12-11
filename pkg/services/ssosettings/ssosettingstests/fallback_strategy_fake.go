package ssosettingstests

import context "context"

type FakeFallbackStrategy struct {
	ExpectedIsMatch bool
	ExpectedConfig  any

	ExpectedError error
}

func NewFakeFallbackStrategy() *FakeFallbackStrategy {
	return &FakeFallbackStrategy{}
}

func (f *FakeFallbackStrategy) IsMatch(provider string) bool {
	return f.ExpectedIsMatch
}

func (f *FakeFallbackStrategy) GetProviderConfig(ctx context.Context, provider string) (any, error) {
	return f.ExpectedConfig, f.ExpectedError
}
