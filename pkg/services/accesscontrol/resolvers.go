package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

// ScopeAttributeResolver is used to resolve attributes in scopes to one or more scopes that are
// evaluated by logical or. E.g. "dashboards:id:1" -> "dashboards:uid:test-dashboard" or "folder:uid:test-folder"
type ScopeAttributeResolver interface {
	Resolve(ctx context.Context, orgID int64, scope string) ([]string, error)
}

// ScopeAttributeResolverFunc is an adapter to allow functions to implement ScopeAttributeResolver interface
type ScopeAttributeResolverFunc func(ctx context.Context, orgID int64, scope string) ([]string, error)

func (f ScopeAttributeResolverFunc) Resolve(ctx context.Context, orgID int64, scope string) ([]string, error) {
	return f(ctx, orgID, scope)
}

type ScopeAttributeMutator func(context.Context, string) ([]string, error)

// ScopeKeywordResolver is used to resolve keywords in scopes e.g. "users:self" -> "user:id:1".
// These type of resolvers is used when fetching stored permissions
type ScopeKeywordResolver interface {
	Resolve(ctx context.Context, user *user.SignedInUser) (string, error)
}

// ScopeKeywordResolverFunc is an adapter to allow functions to implement ScopeKeywordResolver interface
type ScopeKeywordResolverFunc func(ctx context.Context, user *user.SignedInUser) (string, error)

func (f ScopeKeywordResolverFunc) Resolve(ctx context.Context, user *user.SignedInUser) (string, error) {
	return f(ctx, user)
}

type ScopeKeywordMutator func(context.Context, string) (string, error)
