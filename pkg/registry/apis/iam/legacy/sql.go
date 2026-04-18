package legacy

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"text/template"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query ListDisplayQuery) (*ListUserResult, error)

	GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetUserInternalIDQuery) (*GetUserInternalIDResult, error)
	GetUserUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error)
	GetServiceAccountUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error)
	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)
	ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query ListUserTeamsQuery) (*ListUserTeamsResult, error)
	CreateUser(ctx context.Context, ns claims.NamespaceInfo, cmd CreateUserCommand) (*CreateUserResult, error)
	UpdateUser(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateUserCommand) (*UpdateUserResult, error)
	UpdateLastSeenAt(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateUserLastSeenAtCommand) error
	DeleteUser(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) error

	GetServiceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetServiceAccountInternalIDQuery) (*GetServiceAccountInternalIDResult, error)
	ListServiceAccounts(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountsQuery) (*ListServiceAccountResult, error)
	CreateServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd CreateServiceAccountCommand) (*CreateServiceAccountResult, error)
	DeleteServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) error

	ListServiceAccountTokens(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountTokenQuery) (*ListServiceAccountTokenResult, error)

	GetTeamInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetTeamInternalIDQuery) (*GetTeamInternalIDResult, error)
	GetTeamUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetTeamUIDByIDQuery) (*GetTeamUIDByIDResult, error)
	CreateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamCommand) (*CreateTeamResult, error)
	UpdateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamCommand) (*UpdateTeamResult, error)
	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	DeleteTeam(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamCommand) error

	CreateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamMemberCommand) (*CreateTeamMemberResult, error)
	ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error)
	ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error)
	UpdateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamMemberCommand) (*UpdateTeamMemberResult, error)
	DeleteTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamMemberCommand) error
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

// getDB wraps s.sql(ctx) and converts ErrNamespaceNotFound to a K8s NotFound error.
func (s *legacySQLStore) getDB(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
	db, err := s.sql(ctx)
	if err != nil {
		if errors.Is(err, legacysql.ErrNamespaceNotFound) {
			return nil, apierrors.NewNotFound(
				schema.GroupResource{Group: iamv0.GROUP},
				"namespace",
			)
		}
		return nil, err
	}
	return db, nil
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
