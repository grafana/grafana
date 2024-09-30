package store

import (
	"context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type LegacyStore interface {
	GetIdentity(ctx context.Context, ns claims.NamespaceInfo, q GetIdentityQuery) (*GetIdentityResult, error)
	ListPermissions(ctx context.Context, ns claims.NamespaceInfo, q ListPermissionsQuery) (*ListPermissionsResult, error)
}

var _ LegacyStore = (*Store)(nil)

func NewStore(sql legacysql.LegacyDatabaseProvider) *Store {
	return &Store{sql}
}

type Store struct {
	sql legacysql.LegacyDatabaseProvider
}
