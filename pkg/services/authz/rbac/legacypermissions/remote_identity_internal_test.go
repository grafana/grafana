package legacypermissions

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLoadRemoteIdentity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	now := time.Now()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(&user.User{ID: 7, UID: "stored-user", Login: "stored-user", Created: now, Updated: now}, &org.OrgUser{OrgID: 1, UserID: 7, Role: org.RoleViewer, Created: now, Updated: now})
		if err != nil {
			return err
		}
		for i := int64(1); i <= 51; i++ {
			if _, err = sess.Insert(&team.Team{ID: i, UID: "team-" + strconv.FormatInt(i, 10), OrgID: 1, Name: "team-" + strconv.FormatInt(i, 10), Created: now, Updated: now}, &team.TeamMember{UID: "member-" + strconv.FormatInt(i, 10), OrgID: 1, UserID: 7, TeamID: i, Created: now, Updated: now}); err != nil {
				return err
			}
		}
		return nil
	}))
	cfg := setting.NewCfg()
	cfg.Anonymous.OrgRole = "Viewer"
	server := NewRemoteServer(&Loader{store: permissionStore{database: legacysql.NewDatabaseProvider(sql)}, cfg: cfg}, nil, tracing.InitializeTracerForTest())
	ns, err := types.ParseNamespace("stacks-1")
	require.NoError(t, err)
	ctx := request.WithNamespace(context.Background(), ns.Value)
	forgedID := int64(999)
	supplied := &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "stored-user", InternalId: &forgedID, OrgRole: "Admin", IsGrafanaAdmin: true, TeamIds: []int64{999}, Groups: []string{"external-group"}}
	got, err := server.loadIdentity(ctx, ns, supplied, 1)
	require.NoError(t, err)
	require.Equal(t, int64(7), got.GetInternalId())
	require.Equal(t, "stored-user", got.Uid)
	require.Equal(t, "Viewer", got.OrgRole)
	require.False(t, got.IsGrafanaAdmin)
	require.True(t, got.HasUniqueId)
	require.Len(t, got.TeamIds, 51)
	require.Equal(t, supplied.Groups, got.Groups)
	require.Equal(t, int64(999), supplied.GetInternalId())
	for _, orgID := range []int64{0, -1} {
		global, err := server.loadIdentity(ctx, ns, supplied, orgID)
		require.NoError(t, err)
		require.Equal(t, "None", global.OrgRole)
		require.Empty(t, global.TeamIds)
		require.False(t, global.IsGrafanaAdmin)
	}
	supplied.Uid = "7"
	got, err = server.loadIdentity(ctx, ns, supplied, 1)
	require.NoError(t, err)
	require.Equal(t, "stored-user", got.Uid)
	supplied.Uid = "missing"
	_, err = server.loadIdentity(ctx, ns, supplied, 1)
	require.Error(t, err)
	supplied.Type = "anonymous"
	got, err = server.loadIdentity(ctx, ns, supplied, 1)
	require.NoError(t, err)
	require.Equal(t, "Viewer", got.OrgRole)
	require.Nil(t, got.InternalId)
	require.False(t, got.IsGrafanaAdmin)
	require.Empty(t, got.TeamIds)
	require.False(t, got.HasUniqueId)
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Where("id = ?", 7).Cols("is_admin").Update(&user.User{IsAdmin: true})
		return err
	}))
	supplied.Type = "user"
	supplied.Uid = "stored-user"
	got, err = server.loadIdentity(ctx, ns, supplied, 0)
	require.NoError(t, err)
	require.True(t, got.IsGrafanaAdmin)
	require.Equal(t, "None", got.OrgRole)
}
