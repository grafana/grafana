package resourcepermission

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func TestIntegrationCreateResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := db.InitTestDB(t)

	timeNow = func() time.Time {
		return time.Date(2025, 8, 28, 17, 13, 0, 0, time.UTC)
	}

	sqlHelper := &legacysql.LegacyDatabaseHelper{
		DB:    store,
		Table: func(name string) string { return name },
	}

	dbProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return sqlHelper, nil
	}

	t.Run("should create resource permission", func(t *testing.T) {
		resourcePerm := &v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folders.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folders.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindUser,
						Name: "captain",
						Verb: "Edit",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
						Name: "robot",
						Verb: "View",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindTeam,
						Name: "devs",
						Verb: "Admin",
					},
				},
			},
		}

		ctx := context.Background()
		backend := ProvideStorageBackend(dbProvider)
		backend.identityStore = NewFakeIdentityStore(t)
		rv, err := backend.createResourcePermission(ctx, sqlHelper, types.NamespaceInfo{Value: "default", OrgID: 1}, resourcePerm)
		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)

		var (
			assigned int
			roleID   int64
			sess     = store.GetSqlxSession()
		)

		// Check that the roles were created and assigned
		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:users:101:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM user_role WHERE org_id = ? AND role_id = ? AND user_id = ?", 1, roleID, "101")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:users:201:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM user_role WHERE org_id = ? AND role_id = ? AND user_id = ?", 1, roleID, "201")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:teams:301:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM team_role WHERE org_id = ? AND role_id = ? AND team_id = ?", 1, roleID, "301")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:builtins:viewer:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM builtin_role WHERE org_id = ? AND role = ?", 1, "Viewer")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)
	})

}

type fakeIdentityStore struct {
	t *testing.T

	users           map[string]int64
	serviceAccounts map[string]int64
	teams           map[string]int64
	expectedNs      types.NamespaceInfo
}

func NewFakeIdentityStore(t *testing.T) *fakeIdentityStore {
	return &fakeIdentityStore{
		t:               t,
		users:           map[string]int64{"captain": 101},
		serviceAccounts: map[string]int64{"robot": 201},
		teams:           map[string]int64{"devs": 301},
		expectedNs:      types.NamespaceInfo{Value: "default"},
	}
}

// GetServiceAccountInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetServiceAccountInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.serviceAccounts[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetServiceAccountInternalIDResult{ID: id}, nil
}

// GetTeamInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetTeamInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.teams[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetTeamInternalIDResult{ID: id}, nil
}

// GetUserInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetUserInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.users[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetUserInternalIDResult{ID: id}, nil
}
