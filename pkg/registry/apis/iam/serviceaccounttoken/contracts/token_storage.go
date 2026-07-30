// Package contracts holds the token storage seam consumed by authentication.
//
// It is deliberately a leaf: the storage implementation lives in the parent
// package, which depends on the IAM registry and so cannot be imported from
// pkg/services/authn without an import cycle.
package contracts

import (
	"context"

	claims "github.com/grafana/authlib/types"

	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

// TokenInfo carries a token together with the legacy numeric identifiers that
// authentication still needs. satoken.Token itself is namespace and UUID based.
type TokenInfo struct {
	Token *satoken.Token
	// ID is the legacy api_key row id. Zero when the token was read from the
	// dedicated store, which has no numeric id.
	ID int64
	// ServiceAccountID is the numeric user id of the owning service account.
	ServiceAccountID int64
	// LastUsedID is an opaque handle for UpdateLastUsedDate. The two backends key
	// their rows differently, so only the storage may interpret it.
	LastUsedID string
}

// TokenFetcher resolves a service account token from its hashed key. Implemented by
// serviceaccounttoken.ModeAgnosticStorage, which routes by dual-writer mode.
type TokenFetcher interface {
	GetByHash(ctx context.Context, ns claims.NamespaceInfo, hash string) (*TokenInfo, error)
	// UpdateLastUsedDate stamps the token identified by the LastUsedID handle from
	// a previous GetByHash.
	UpdateLastUsedDate(ctx context.Context, ns claims.NamespaceInfo, lastUsedID string) error
}
