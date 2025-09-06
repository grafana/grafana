package legacy

import (
	"context"
	"database/sql/driver"
	"embed"
	"fmt"
	"text/template"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query ListDisplayQuery) (*ListUserResult, error)

	GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetUserInternalIDQuery) (*GetUserInternalIDResult, error)
	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)
	ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query ListUserTeamsQuery) (*ListUserTeamsResult, error)
	CreateUser(ctx context.Context, ns claims.NamespaceInfo, cmd CreateUserCommand) (*CreateUserResult, error)
	DeleteUser(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) (*DeleteUserResult, error)

	GetServiceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetServiceAccountInternalIDQuery) (*GetServiceAccountInternalIDResult, error)
	ListServiceAccounts(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountsQuery) (*ListServiceAccountResult, error)
	CreateServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd CreateServiceAccountCommand) (*CreateServiceAccountResult, error)

	ListServiceAccountTokens(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountTokenQuery) (*ListServiceAccountTokenResult, error)

	GetTeamInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetTeamInternalIDQuery) (*GetTeamInternalIDResult, error)
	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error)
	ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error)
}

var _ LegacyIdentityStore = (*legacySQLStore)(nil)

func NewLegacySQLStores(sql legacysql.LegacyDatabaseProvider) LegacyIdentityStore {
	return &legacySQLStore{
		sql: sql,
	}
}

type legacySQLStore struct {
	sql legacysql.LegacyDatabaseProvider
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

type DBTime struct {
	time.Time
}

func NewDBTime(t time.Time) DBTime {
	return DBTime{Time: t}
}

func (t DBTime) Value() (driver.Value, error) {
	if t.IsZero() {
		return nil, nil
	}

	return t.Format(time.DateTime), nil
}

func (t *DBTime) Scan(value interface{}) error {
	if value == nil {
		t.Time = time.Time{}
		return nil
	}

	var parsedTime time.Time
	var err error

	switch v := value.(type) {
	case []byte:
		parsedTime, err = time.Parse(time.DateTime, string(v))
	case string:
		parsedTime, err = time.Parse(time.DateTime, v)
	case time.Time:
		parsedTime = v
	default:
		return fmt.Errorf("could not scan type %T into DBTime", value)
	}

	if err != nil {
		return fmt.Errorf("could not parse time: %w", err)
	}

	t.Time = parsedTime
	return nil
}
