package authimpl

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	tokenTable := "test_schema.user_auth_token"
	externalSessionTable := "test_schema.user_external_session"
	newSQLTemplate := func() sqltemplate.SQLTemplate { return mocks.NewTestingSQLTemplate() }
	token := &userAuthToken{Id: 1, UserId: 2, AuthToken: "token", PrevAuthToken: "previous", UserAgent: "agent", ClientIp: "127.0.0.1", AuthTokenSeen: true, SeenAt: 3, RotatedAt: 4, CreatedAt: 5, UpdatedAt: 6, RevokedAt: 7, ExternalSessionId: 8}
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	session := &auth.ExternalSession{UserID: 2, UserAuthID: 3, AuthModule: "oauth", AccessToken: "access", IDToken: "id", RefreshToken: "refresh", SessionID: "session", SessionIDHash: "session-hash", NameID: "name", NameIDHash: "name-hash"}
	tokenCase := func(name string, mutate func(*tokenQuery)) mocks.TemplateTestCase {
		query := tokenQuery{SQLTemplate: newSQLTemplate(), TokenTable: tokenTable, Token: token, HashedToken: "hash", ExpectedToken: "expected", ExternalSessionID: 8, UserAgent: "agent", ClientIP: "127.0.0.1", RotatedAt: 4, TokenID: 1, UserID: 2, UserIDs: []int64{2, 4}, CreatedAfter: 5, RotatedAfter: 6, RevokedBefore: 7, CreatedBefore: 8, RotatedBefore: 9}
		if mutate != nil {
			mutate(&query)
		}
		return mocks.TemplateTestCase{Name: name, Data: query}
	}
	externalCase := func(name string, mutate func(*externalSessionQuery)) mocks.TemplateTestCase {
		query := externalSessionQuery{SQLTemplate: newSQLTemplate(), ExternalSessionTable: externalSessionTable, Session: session, ID: 1, UserID: 2, UserIDs: []int64{2, 4}, SessionIDHash: "session-hash", NameIDHash: "name-hash", ExpiresAt: legacysql.NewDBTime(now), CreatedAt: legacysql.NewDBTime(now)}
		if mutate != nil {
			mutate(&query)
		}
		return mocks.TemplateTestCase{Name: name, Data: query}
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			insertTokenTemplate:                 {tokenCase("insert", nil)},
			lookupTokenTemplate:                 {tokenCase("lookup", nil)},
			updateTokenTemplate:                 {tokenCase("current", nil), tokenCase("previous", func(q *tokenQuery) { q.Previous = true })},
			getTokenByExternalSessionIDTemplate: {tokenCase("by_external_session", nil)},
			rotateTokenTemplate:                 {tokenCase("rotate", nil)},
			softRevokeTokenTemplate:             {tokenCase("soft_revoke", nil)},
			hardRevokeTokenTemplate:             {tokenCase("hard_revoke", nil)},
			deleteTokensByUserIDTemplate:        {tokenCase("one_user", nil)},
			deleteTokensByUserIDsTemplate:       {tokenCase("multiple_users", nil)},
			getUserTokenTemplate:                {tokenCase("one_token", nil)},
			getUserTokensTemplate:               {tokenCase("active_tokens", nil)},
			countActiveTokensTemplate: {
				tokenCase("all_users", nil),
				tokenCase("one_user", func(q *tokenQuery) { q.HasUserID = true }),
			},
			deleteUserRevokedTokensTemplate: {tokenCase("delete_revoked", nil)},
			getUserRevokedTokensTemplate:    {tokenCase("revoked_tokens", nil)},
			getExternalSessionTemplate:      {externalCase("get", nil)},
			listExternalSessionsTemplate: {
				externalCase("all", func(q *externalSessionQuery) { q.ID, q.UserID, q.SessionIDHash, q.NameIDHash = 0, 0, "", "" }),
				externalCase("filtered", nil),
			},
			insertExternalSessionTemplate:           {externalCase("insert", nil)},
			updateExternalSessionTemplate:           {externalCase("update", nil)},
			deleteExternalSessionTemplate:           {externalCase("delete", nil)},
			deleteExternalSessionsByUserIDTemplate:  {externalCase("one_user", nil)},
			deleteExternalSessionsByUserIDsTemplate: {externalCase("multiple_users", nil)},
			deleteExpiredTokensTemplate:             {tokenCase("expired", nil)},
			deleteOrphanedExternalSessionsTemplate: {{
				Name: "orphaned",
				Data: orphanedExternalSessionsQuery{
					SQLTemplate:                  newSQLTemplate(),
					ExternalSessionTable:         externalSessionTable,
					TokenTable:                   tokenTable,
					ExternalSessionIDColumn:      "user_external_session.id",
					TokenExternalSessionIDColumn: "token.external_session_id",
				},
			}},
		},
	})
}
