package ssosettingstests

import context "context"

type FakeFallbackStrategy struct {
	ExpectedIsMatch          bool
	ExpectedConfigs          map[string]map[string]any
	ExpectedServesMTSettings bool

	ExpectedError error
}

func (f *FakeFallbackStrategy) ServesMTSettings() bool {
	return f.ExpectedServesMTSettings
}

func NewFakeFallbackStrategy() *FakeFallbackStrategy {
	return &FakeFallbackStrategy{}
}

func (f *FakeFallbackStrategy) IsMatch(_ context.Context, provider string) bool {
	return f.ExpectedIsMatch
}

func (f *FakeFallbackStrategy) GetProviderConfig(ctx context.Context, provider string) (map[string]any, error) {
	return f.ExpectedConfigs[provider], f.ExpectedError
}
