package authimpl

import (
	"embed"
	"fmt"
	"text/template"
)

// Templates setup.
var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `queries/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	rotateTokenTemplate                    = mustTemplate("rotate_token.sql")
	revokeAllUserTokensTemplate            = mustTemplate("revoke_all_user_tokens.sql")
	batchRevokeAllUserTokensTemplate       = mustTemplate("batch_revoke_all_user_tokens.sql")
	activeTokenCountTemplate               = mustTemplate("active_token_count.sql")
	deleteUserRevokedTokensTemplate        = mustTemplate("delete_user_revoked_tokens.sql")
	deleteExpiredTokensTemplate            = mustTemplate("delete_expired_tokens.sql")
	deleteOrphanedExternalSessionsTemplate = mustTemplate("delete_orphaned_external_sessions.sql")
)
