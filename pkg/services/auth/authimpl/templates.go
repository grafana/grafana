package authimpl

import (
	"embed"
	"fmt"
	"text/template"
)

//go:embed queries/*.sql
var sqlTemplatesFS embed.FS

var sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

var (
	insertTokenTemplate                     = mustTemplate("insert_token.sql")
	lookupTokenTemplate                     = mustTemplate("lookup_token.sql")
	updateTokenTemplate                     = mustTemplate("update_token.sql")
	getTokenByExternalSessionIDTemplate     = mustTemplate("get_token_by_external_session_id.sql")
	rotateTokenTemplate                     = mustTemplate("rotate_token.sql")
	softRevokeTokenTemplate                 = mustTemplate("soft_revoke_token.sql")
	hardRevokeTokenTemplate                 = mustTemplate("hard_revoke_token.sql")
	deleteTokensByUserIDTemplate            = mustTemplate("delete_tokens_by_user_id.sql")
	deleteTokensByUserIDsTemplate           = mustTemplate("delete_tokens_by_user_ids.sql")
	getUserTokenTemplate                    = mustTemplate("get_user_token.sql")
	getUserTokensTemplate                   = mustTemplate("get_user_tokens.sql")
	countActiveTokensTemplate               = mustTemplate("count_active_tokens.sql")
	deleteUserRevokedTokensTemplate         = mustTemplate("delete_user_revoked_tokens.sql")
	getUserRevokedTokensTemplate            = mustTemplate("get_user_revoked_tokens.sql")
	getExternalSessionTemplate              = mustTemplate("get_external_session.sql")
	listExternalSessionsTemplate            = mustTemplate("list_external_sessions.sql")
	insertExternalSessionTemplate           = mustTemplate("insert_external_session.sql")
	updateExternalSessionTemplate           = mustTemplate("update_external_session.sql")
	deleteExternalSessionTemplate           = mustTemplate("delete_external_session.sql")
	deleteExternalSessionsByUserIDTemplate  = mustTemplate("delete_external_sessions_by_user_id.sql")
	deleteExternalSessionsByUserIDsTemplate = mustTemplate("delete_external_sessions_by_user_ids.sql")
	deleteExpiredTokensTemplate             = mustTemplate("delete_expired_tokens.sql")
	deleteOrphanedExternalSessionsTemplate  = mustTemplate("delete_orphaned_external_sessions.sql")
)
