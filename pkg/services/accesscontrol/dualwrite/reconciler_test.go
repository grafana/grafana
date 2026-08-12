package dualwrite

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestZanzanaReconciler_hasBasicRolePermissions(t *testing.T) {
	env := setupTestEnv(t)

	r := &ZanzanaReconciler{
		store: env.db,
	}

	ctx := context.Background()
	require.False(t, r.hasBasicRolePermissions(ctx))

	err := env.db.WithDbSession(ctx, func(sess *db.Session) error {
		now := time.Now()

		_, err := sess.Exec(
			`INSERT INTO role (org_id, uid, name, display_name, group_name, description, hidden, version, created, updated)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			accesscontrol.GlobalOrgID,
			"basic_viewer_uid_test",
			accesscontrol.BasicRolePrefix+"viewer",
			"Viewer",
			"Basic",
			"Viewer role",
			false,
			1,
			now,
			now,
		)
		if err != nil {
			return err
		}

		var roleID int64
		if _, err := sess.SQL(`SELECT id FROM role WHERE org_id = ? AND uid = ?`, accesscontrol.GlobalOrgID, "basic_viewer_uid_test").Get(&roleID); err != nil {
			return err
		}

		_, err = sess.Exec(
			`INSERT INTO permission (role_id, action, scope, kind, attribute, identifier, created, updated)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			roleID,
			"dashboards:read",
			"dashboards:*",
			"",
			"",
			"",
			now,
			now,
		)
		return err
	})
	require.NoError(t, err)

	require.True(t, r.hasBasicRolePermissions(ctx))
}
