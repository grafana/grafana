package featuremgmt

import (
	"github.com/open-feature/go-sdk/openfeature"
	"golang.org/x/net/context"
)

type FeatureFlags interface {
	IsEnabled(context.Context, string) bool
}

type FeatureFlagsClient struct {
	delegate *openfeature.Client
}

func NewFeatureFlagsClient() *FeatureFlagsClient {
	return &FeatureFlagsClient{
		delegate: openfeature.NewDefaultClient(),
	}
}

func (ff *FeatureFlagsClient) IsEnabled(ctx context.Context, flag string) bool {
	return ff.delegate.Boolean(ctx, flag, false, openfeature.TransactionContext(ctx))
}
