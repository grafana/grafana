package ssosettingstests

import context "context"

type FakeFallbackStrategy struct {
	ExpectedIsMatch bool
	ExpectedConfig  map[string]interface{}

	ExpectedError error
}

func NewFakeFallbackStrategy() *FakeFallbackStrategy {
	return &FakeFallbackStrategy{}
}

func (f *FakeFallbackStrategy) IsMatch(provider string) bool {
	return f.ExpectedIsMatch
}

func (f *FakeFallbackStrategy) ParseConfigFromSystem(ctx context.Context) (map[string]interface{}, error) {
	return f.ExpectedConfig, f.ExpectedError
}
