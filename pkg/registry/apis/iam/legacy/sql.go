package legacy

import (
	"context"
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query ListDisplayQuery) (*ListUserResult, error)

	GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetUserInternalIDQuery) (*GetUserInternalIDResult, error)
	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)
	ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query ListUserTeamsQuery) (*ListUserTeamsResult, error)

	GetServiceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetServiceAccountInternalIDQuery) (*GetServiceAccountInternalIDResult, error)
	ListServiceAccounts(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountsQuery) (*ListServiceAccountResult, error)
	ListServiceAccountTokens(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountTokenQuery) (*ListServiceAccountTokenResult, error)

	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error)
	ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error)
}

var (
	_ LegacyIdentityStore = (*legacySQLStore)(nil)
)

func NewLegacySQLStores(sql legacysql.LegacyDatabaseProvider) LegacyIdentityStore {
	return &legacySQLStore{
		sql: sql,
	}
}

type legacySQLStore struct {
	sql legacysql.LegacyDatabaseProvider
	ac  claims.AccessClient
}

func (s *legacySQLStore) WithAccessClient(ac claims.AccessClient) {
	s.ac = ac
}

// Templates setup.
var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}
