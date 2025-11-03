package featureflags

import (
	"github.com/open-feature/go-sdk/openfeature"
	"golang.org/x/net/context"
)

type FeatureFlags interface {
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
