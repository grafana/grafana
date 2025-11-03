package featureflags

import (
	"github.com/open-feature/go-sdk/openfeature"
	"golang.org/x/net/context"
)

// FeatureFlags interface provides a convenient abstraction around OpenFeature SDK
// OpenFeature is an open standard and SDK framework for managing feature flags consistently across applications and platforms.
// Remote evaluation allows applications to determine the state of feature flags dynamically from a central service,
// enabling real-time feature control without redeploying code.
type FeatureFlags interface {

	// IsEnabled checks if a feature is enabled for a given context.
	// The settings may be per user, tenant, or globally set in the cloud.
	//
	// Always perform flag evaluation at runtime, not during service startup, to ensure correct and up-to-date flag values.
	IsEnabled(context.Context, string) bool
}

type Client struct {
	delegate *openfeature.Client
}

func NewClient() *Client {
	return &Client{
		delegate: openfeature.NewDefaultClient(),
	}
}

func (ff *Client) IsEnabled(ctx context.Context, flag string) bool {
	return ff.delegate.Boolean(ctx, flag, false, openfeature.TransactionContext(ctx))
}
