package legacypermissions_test

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func seedRemoteIdentity(t *testing.T, sql db.DB) {
	t.Helper()
	now := time.Now()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(&user.User{ID: 7, UID: "user-7", Login: "remote-user", Email: "remote@example.com", Created: now, Updated: now},
			&org.OrgUser{OrgID: 1, UserID: 7, Role: org.RoleViewer, Created: now, Updated: now},
			&team.Team{ID: 9, UID: "team-9", OrgID: 1, Name: "remote-team", Created: now, Updated: now},
			&team.TeamMember{OrgID: 1, UserID: 7, TeamID: 9, Created: now, Updated: now})
		return err
	}))
}
