package authimpl

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	// nodb resolves schema-qualified identifiers so the snapshots prove
	// .Ident quotes each component correctly for every dialect.
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "test_schema." + n
		},
	}

	getRevokeAllUserTokens := func() sqltemplate.SQLTemplate {
		v := revokeAllUserTokensQuery{
			SQLTemplate: sqltemplate.New(nodb.DialectForDriver()),
			TokenTable:  nodb.Table("user_auth_token"),
			UserID:      10,
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getBatchRevokeAllUserTokens := func() sqltemplate.SQLTemplate {
		v := batchRevokeAllUserTokensQuery{
			SQLTemplate: sqltemplate.New(nodb.DialectForDriver()),
			TokenTable:  nodb.Table("user_auth_token"),
			UserIDs:     []int64{10, 11, 12},
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getActiveTokenCount := func(filterByUser bool) sqltemplate.SQLTemplate {
		v := activeTokenCountQuery{
			SQLTemplate:  sqltemplate.New(nodb.DialectForDriver()),
			TokenTable:   nodb.Table("user_auth_token"),
			CreatedAfter: 1600000000,
			SeenAfter:    1650000000,
		}
		if filterByUser {
			v.FilterByUser = true
			v.UserID = 10
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getDeleteUserRevokedTokens := func() sqltemplate.SQLTemplate {
		v := deleteUserRevokedTokensQuery{
			SQLTemplate:   sqltemplate.New(nodb.DialectForDriver()),
			TokenTable:    nodb.Table("user_auth_token"),
			UserID:        10,
			RevokedBefore: 1700000000,
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getDeleteExpiredTokens := func() sqltemplate.SQLTemplate {
		v := deleteExpiredTokensQuery{
			SQLTemplate:   sqltemplate.New(nodb.DialectForDriver()),
			TokenTable:    nodb.Table("user_auth_token"),
			CreatedBefore: 1600000000,
			SeenBefore:    1650000000,
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getDeleteOrphanedExternalSessions := func() sqltemplate.SQLTemplate {
		v := deleteOrphanedExternalSessionsQuery{
			SQLTemplate:          sqltemplate.New(nodb.DialectForDriver()),
			ExternalSessionTable: nodb.Table("user_external_session"),
			TokenTable:           nodb.Table("user_auth_token"),
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			revokeAllUserTokensTemplate: {
				{
					Name: "revoke_all_user_tokens",
					Data: getRevokeAllUserTokens(),
				},
			},
			batchRevokeAllUserTokensTemplate: {
				{
					Name: "batch_revoke_all_user_tokens",
					Data: getBatchRevokeAllUserTokens(),
				},
			},
			activeTokenCountTemplate: {
				{
					Name: "all_users",
					Data: getActiveTokenCount(false),
				},
				{
					Name: "single_user",
					Data: getActiveTokenCount(true),
				},
			},
			deleteUserRevokedTokensTemplate: {
				{
					Name: "delete_user_revoked_tokens",
					Data: getDeleteUserRevokedTokens(),
				},
			},
			deleteExpiredTokensTemplate: {
				{
					Name: "delete_expired_tokens",
					Data: getDeleteExpiredTokens(),
				},
			},
			deleteOrphanedExternalSessionsTemplate: {
				{
					Name: "delete_orphaned_external_sessions",
					Data: getDeleteOrphanedExternalSessions(),
				},
			},
		},
	})
}
