package featureflags

import (
	"context"
	"fmt"
)

type ctxFlagsKey struct{}

type FeatureFlags interface {
	IsEnabled(flag string) bool
}

// WithUser adds the supplied SignedInUser to the context.
func WithFeatureFlags(ctx context.Context, flags FeatureFlags) context.Context {
	return context.WithValue(ctx, ctxFlagsKey{}, flags)
}

func GetFeatureFlags(ctx context.Context) (FeatureFlags, error) {
	// Set by appcontext.WithUser
	f, ok := ctx.Value(ctxFlagsKey{}).(FeatureFlags)
	if ok && f != nil {
		return f, nil
	}
	return nil, fmt.Errorf("no flags set in context")
}

// MustGetFeatureFlags extracts the feature flags and panics if they are not registered
func MustGetFeatureFlags(ctx context.Context) FeatureFlags {
	f, err := GetFeatureFlags(ctx)
	if err != nil {
		panic(err)
	}
	return f
}
