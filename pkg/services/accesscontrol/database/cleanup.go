package database

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// CleanupPluginRBAC removes all RBAC data associated with the given plugin IDs:
//   - permissions on any role whose action starts with "<pluginID>." or "<pluginID>:"
//   - permissions on any role scoped to "plugins:id:<pluginID>"
//   - the plugin's own fixed roles (name LIKE 'plugins:<pluginID>:%') and all
//     their permission, user_role, and team_role rows
func (s *AccessControlStore) CleanupPluginRBAC(ctx context.Context, pluginIDs []string) error {
	for _, pluginID := range pluginIDs {
		if pluginID == "" || strings.ContainsAny(pluginID, `%_\`) {
			return fmt.Errorf("invalid plugin ID %q: must be non-empty and must not contain '%%', '_', or '\\'", pluginID)
		}
		if err := cleanupPlugin(ctx, s.sql, pluginID); err != nil {
			return err
		}
	}
	return nil
}

func cleanupPlugin(ctx context.Context, sql db.DB, pluginID string) error {
	pluginScope := accesscontrol.Scope("plugins", "id", pluginID)

	return sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// 1. Delete permissions from all roles whose action belongs to the plugin.
		//    Covers plugin-defined actions (e.g. "myPlugin.dashboards:read") and
		//    namespace-style actions (e.g. "myPlugin:read").
		if _, err := sess.Exec(
			`DELETE FROM permission WHERE action LIKE ? OR action LIKE ?`,
			pluginID+".%",
			pluginID+":%",
		); err != nil {
			return err
		}

		// 2. Delete permissions scoped to the plugin (exact match).
		//    Covers generic actions like "plugins.app:access" with scope "plugins:id:<pluginID>".
		if _, err := sess.Exec(
			`DELETE FROM permission WHERE scope = ?`,
			pluginScope,
		); err != nil {
			return err
		}

		// 3. Find the plugin's fixed role IDs.
		type roleRow struct {
			ID int64 `xorm:"id"`
		}
		var rows []roleRow
		if err := sess.SQL(
			`SELECT id FROM role WHERE org_id = ? AND name LIKE ?`,
			accesscontrol.GlobalOrgID,
			accesscontrol.PluginRolePrefix+pluginID+":%",
		).Find(&rows); err != nil {
			return err
		}

		if len(rows) == 0 {
			return nil
		}

		ids := make([]any, len(rows))
		for i, r := range rows {
			ids[i] = r.ID
		}
		placeholders := "?" + strings.Repeat(",?", len(ids)-1)

		// 4a. Delete permissions still attached to the plugin roles.
		if _, err := sess.Exec(
			append([]any{`DELETE FROM permission WHERE role_id IN (` + placeholders + `)`}, ids...)...,
		); err != nil {
			return err
		}

		// 4b. Delete user_role assignments for the plugin roles.
		if _, err := sess.Exec(
			append([]any{`DELETE FROM user_role WHERE role_id IN (` + placeholders + `)`}, ids...)...,
		); err != nil {
			return err
		}

		// 4c. Delete team_role assignments for the plugin roles.
		if _, err := sess.Exec(
			append([]any{`DELETE FROM team_role WHERE role_id IN (` + placeholders + `)`}, ids...)...,
		); err != nil {
			return err
		}

		// 4d. Delete the plugin roles themselves.
		if _, err := sess.Exec(
			append([]any{`DELETE FROM role WHERE id IN (` + placeholders + `)`}, ids...)...,
		); err != nil {
			return err
		}

		return nil
	})
}
