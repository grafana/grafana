package dualwrite

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type testEnv struct {
	sql       *sqlstore.SQLStore
	db        db.DB
	cfg       *setting.Cfg
	userSvc   user.Service
	teamSvc   team.Service
	orgSvc    org.Service
	folderSvc folder.Service
	ctx       context.Context
}

func setupTestEnv(t *testing.T) *testEnv {
	t.Helper()

	sql, cfg := db.InitTestDBWithCfg(t)
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgRole = "Viewer"
	cfg.AutoAssignOrgId = 1

	teamService, err := teamimpl.ProvideService(sql, cfg, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	orgService, err := orgimpl.ProvideService(sql, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	userService, err := userimpl.ProvideService(
		sql, orgService, cfg, teamService, localcache.ProvideService(), tracing.InitializeTracerForTest(),
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	// Create test org
	orgID, err := orgService.GetOrCreate(context.Background(), "test")
	require.NoError(t, err)
	require.Equal(t, int64(1), orgID)

	return &testEnv{
		sql:       sql,
		db:        sql,
		cfg:       cfg,
		userSvc:   userService,
		teamSvc:   teamService,
		orgSvc:    orgService,
		folderSvc: nil, // Set per test if needed
		ctx:       context.Background(),
	}
}

func createUser(t *testing.T, env *testEnv, login string, orgID int64, isServiceAccount bool) *user.User {
	t.Helper()

	u, err := env.userSvc.Create(env.ctx, &user.CreateUserCommand{
		Login:            login,
		OrgID:            orgID,
		IsServiceAccount: isServiceAccount,
	})
	require.NoError(t, err)
	return u
}

func createTeam(t *testing.T, env *testEnv, name string, orgID int64) team.Team {
	t.Helper()

	tm, err := env.teamSvc.CreateTeam(env.ctx, &team.CreateTeamCommand{
		Name:  name,
		OrgID: orgID,
	})
	require.NoError(t, err)
	return tm
}

func addTeamMember(t *testing.T, env *testEnv, userID, orgID, teamID int64, permission int) {
	t.Helper()

	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		_, err := sess.Exec("INSERT INTO team_member (org_id, team_id, user_id, permission, created, updated) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
			orgID, teamID, userID, permission)
		return err
	})
	require.NoError(t, err)
}

func createRole(t *testing.T, env *testEnv, name string, orgID int64) string {
	t.Helper()

	var roleUID string
	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		uid := fmt.Sprintf("role-%s-%d", name, orgID)
		_, err := sess.Exec("INSERT INTO role (uid, name, org_id, version, created, updated) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
			uid, name, orgID, 1)
		roleUID = uid
		return err
	})
	require.NoError(t, err)
	return roleUID
}

func addUserRole(t *testing.T, env *testEnv, userID int64, roleUID string, orgID int64) {
	t.Helper()

	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		var roleID int64
		_, err := sess.SQL("SELECT id FROM role WHERE uid = ?", roleUID).Get(&roleID)
		if err != nil {
			return err
		}
		_, err = sess.Exec("INSERT INTO user_role (org_id, user_id, role_id, created) VALUES (?, ?, ?, datetime('now'))",
			orgID, userID, roleID)
		return err
	})
	require.NoError(t, err)
}

func addTeamRole(t *testing.T, env *testEnv, teamID int64, roleUID string, orgID int64) {
	t.Helper()

	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		var roleID int64
		_, err := sess.SQL("SELECT id FROM role WHERE uid = ?", roleUID).Get(&roleID)
		if err != nil {
			return err
		}
		_, err = sess.Exec("INSERT INTO team_role (org_id, team_id, role_id, created) VALUES (?, ?, ?, datetime('now'))",
			orgID, teamID, roleID)
		return err
	})
	require.NoError(t, err)
}

func addPermission(t *testing.T, env *testEnv, roleUID, action, kind, identifier string) {
	t.Helper()

	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		var roleID int64
		_, err := sess.SQL("SELECT id FROM role WHERE uid = ?", roleUID).Get(&roleID)
		if err != nil {
			return err
		}
		_, err = sess.Exec("INSERT INTO permission (role_id, action, scope, kind, attribute, identifier, created, updated) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
			roleID, action, fmt.Sprintf("%s:uid:%s", kind, identifier), kind, "uid", identifier)
		return err
	})
	require.NoError(t, err)
}

func addBuiltinRole(t *testing.T, env *testEnv, roleUID, builtinRole string, orgID int64) {
	t.Helper()

	err := env.db.WithDbSession(env.ctx, func(sess *db.Session) error {
		var roleID int64
		_, err := sess.SQL("SELECT id FROM role WHERE uid = ?", roleUID).Get(&roleID)
		if err != nil {
			return err
		}
		_, err = sess.Exec("INSERT INTO builtin_role (role_id, org_id, role, created, updated) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
			roleID, orgID, builtinRole)
		return err
	})
	require.NoError(t, err)
}

// Mock zanzana client for testing
type mockZanzanaClient struct {
	mock.Mock
}

func (m *mockZanzanaClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authzextv1.ReadResponse), args.Error(1)
}

func (m *mockZanzanaClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	args := m.Called(ctx, req)
	return args.Error(0)
}

func (m *mockZanzanaClient) BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authzextv1.BatchCheckResponse), args.Error(1)
}

// authlib.AccessClient methods
func (m *mockZanzanaClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	args := m.Called(ctx, id, req, folder)
	return args.Get(0).(authlib.CheckResponse), args.Error(1)
}

func (m *mockZanzanaClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	args := m.Called(ctx, id, req)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	return args.Get(0).(authlib.ItemChecker), args.Get(1).(authlib.Zookie), args.Error(2)
}

func TestIntegrationTeamMembershipCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect team members with member permission", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		team1 := createTeam(t, env, "team1", 1)
		addTeamMember(t, env, user1.ID, 1, team1.ID, 0) // 0 = member permission

		collector := teamMembershipCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 1)

		teamObject := zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, "")
		require.Contains(t, tuples, teamObject)

		teamTuples := tuples[teamObject]
		require.Len(t, teamTuples, 1)

		var tuple *openfgav1.TupleKey
		for _, t := range teamTuples {
			tuple = t
			break
		}

		assert.Equal(t, zanzana.NewTupleEntry(zanzana.TypeUser, user1.UID, ""), tuple.User)
		assert.Equal(t, zanzana.RelationTeamMember, tuple.Relation)
		assert.Equal(t, teamObject, tuple.Object)
	})

	t.Run("should collect team admins with admin permission", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		team1 := createTeam(t, env, "team1", 1)
		addTeamMember(t, env, user1.ID, 1, team1.ID, 4) // 4 = admin permission

		collector := teamMembershipCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 1)

		teamObject := zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, "")
		teamTuples := tuples[teamObject]

		var tuple *openfgav1.TupleKey
		for _, t := range teamTuples {
			tuple = t
			break
		}

		assert.Equal(t, zanzana.RelationTeamAdmin, tuple.Relation)
	})

	t.Run("should collect multiple team members", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		user2 := createUser(t, env, "user2", 1, false)
		team1 := createTeam(t, env, "team1", 1)
		addTeamMember(t, env, user1.ID, 1, team1.ID, 0)
		addTeamMember(t, env, user2.ID, 1, team1.ID, 4)

		collector := teamMembershipCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		teamObject := zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, "")
		teamTuples := tuples[teamObject]
		require.Len(t, teamTuples, 2)
	})

	t.Run("should return empty for no team memberships", func(t *testing.T) {
		env := setupTestEnv(t)

		collector := teamMembershipCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Empty(t, tuples)
	})

	t.Run("should filter by org ID", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		team1 := createTeam(t, env, "team1", 1)
		addTeamMember(t, env, user1.ID, 1, team1.ID, 0)

		// Collect for org 1 only
		collector := teamMembershipCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 1)

		teamObject := zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, "")
		require.Contains(t, tuples, teamObject)
	})
}

func TestIntegrationFolderTreeCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect folder parent relationships", func(t *testing.T) {
		env := setupTestEnv(t)

		fakeFolderSvc := foldertest.NewFakeService()
		fakeFolderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "child1", ParentUID: "parent1", OrgID: 1},
			{UID: "child2", ParentUID: "parent1", OrgID: 1},
		}

		collector := folderTreeCollector(fakeFolderSvc)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 2)

		child1Object := zanzana.NewTupleEntry(zanzana.TypeFolder, "child1", "")
		require.Contains(t, tuples, child1Object)

		child1Tuples := tuples[child1Object]
		require.Len(t, child1Tuples, 1)

		var tuple *openfgav1.TupleKey
		for _, t := range child1Tuples {
			tuple = t
			break
		}

		assert.Equal(t, child1Object, tuple.Object)
		assert.Equal(t, zanzana.RelationParent, tuple.Relation)
		assert.Equal(t, zanzana.NewTupleEntry(zanzana.TypeFolder, "parent1", ""), tuple.User)
	})

	t.Run("should skip folders without parents", func(t *testing.T) {
		env := setupTestEnv(t)

		fakeFolderSvc := foldertest.NewFakeService()
		fakeFolderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "root1", ParentUID: "", OrgID: 1},
			{UID: "child1", ParentUID: "root1", OrgID: 1},
		}

		collector := folderTreeCollector(fakeFolderSvc)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 1) // Only child1 should be collected

		child1Object := zanzana.NewTupleEntry(zanzana.TypeFolder, "child1", "")
		require.Contains(t, tuples, child1Object)
	})

	t.Run("should handle pagination", func(t *testing.T) {
		env := setupTestEnv(t)

		fakeFolderSvc := foldertest.NewFakeService()

		// Create 250 folders to test pagination
		var folders []*folder.Folder
		for i := 1; i <= 250; i++ {
			folders = append(folders, &folder.Folder{
				UID:       fmt.Sprintf("child%d", i),
				ParentUID: "parent1",
				OrgID:     1,
			})
		}

		// Mock GetFolders to return pages
		fakeFolderSvc.ExpectedFolders = folders

		collector := folderTreeCollector(fakeFolderSvc)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Len(t, tuples, 250)
	})

	t.Run("should return empty for no folders", func(t *testing.T) {
		env := setupTestEnv(t)

		fakeFolderSvc := foldertest.NewFakeService()
		fakeFolderSvc.ExpectedFolders = []*folder.Folder{}

		collector := folderTreeCollector(fakeFolderSvc)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Empty(t, tuples)
	})

	t.Run("should handle folder service error", func(t *testing.T) {
		env := setupTestEnv(t)

		fakeFolderSvc := foldertest.NewFakeService()
		fakeFolderSvc.ExpectedError = fmt.Errorf("folder service error")

		collector := folderTreeCollector(fakeFolderSvc)
		_, err := collector(env.ctx, 1)

		require.Error(t, err)
	})
}

func TestIntegrationBasicRoleBindingsCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect basic role bindings for regular users", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)

		// Update org role
		err := env.orgSvc.UpdateOrgUser(env.ctx, &org.UpdateOrgUserCommand{
			OrgID:  1,
			UserID: user1.ID,
			Role:   org.RoleAdmin,
		})
		require.NoError(t, err)

		collector := basicRoleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)

		roleObject := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole("Admin"), "")
		require.Contains(t, tuples, roleObject)

		roleTuples := tuples[roleObject]
		require.NotEmpty(t, roleTuples)

		var found bool
		for _, tuple := range roleTuples {
			if tuple.User == zanzana.NewTupleEntry(zanzana.TypeUser, user1.UID, "") {
				assert.Equal(t, zanzana.RelationAssignee, tuple.Relation)
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("should collect basic role bindings for service accounts", func(t *testing.T) {
		env := setupTestEnv(t)

		sa := createUser(t, env, "sa1", 1, true)

		collector := basicRoleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		// Find service account tuple
		var found bool
		for _, roleTuples := range tuples {
			for _, tuple := range roleTuples {
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeServiceAccount, sa.UID, "") {
					found = true
					break
				}
			}
		}
		assert.True(t, found)
	})

	t.Run("should collect multiple users with different roles", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		user2 := createUser(t, env, "user2", 1, false)

		err := env.orgSvc.UpdateOrgUser(env.ctx, &org.UpdateOrgUserCommand{
			OrgID:  1,
			UserID: user1.ID,
			Role:   org.RoleAdmin,
		})
		require.NoError(t, err)

		err = env.orgSvc.UpdateOrgUser(env.ctx, &org.UpdateOrgUserCommand{
			OrgID:  1,
			UserID: user2.ID,
			Role:   org.RoleEditor,
		})
		require.NoError(t, err)

		collector := basicRoleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		adminRole := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole("Admin"), "")
		editorRole := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole("Editor"), "")

		require.Contains(t, tuples, adminRole)
		require.Contains(t, tuples, editorRole)
	})
}

func TestIntegrationManagedPermissionsCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect managed permissions for users", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		roleUID := createRole(t, env, "managed:dashboard:uid1:permissions", 1)
		addUserRole(t, env, user1.ID, roleUID, 1)
		addPermission(t, env, roleUID, "dashboards:read", "dashboards", "uid1")

		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)
	})

	t.Run("should collect managed permissions for service accounts", func(t *testing.T) {
		env := setupTestEnv(t)

		sa := createUser(t, env, "sa1", 1, true)
		roleUID := createRole(t, env, "managed:dashboard:uid1:permissions", 1)
		addUserRole(t, env, sa.ID, roleUID, 1)
		addPermission(t, env, roleUID, "dashboards:read", "dashboards", "uid1")

		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)

		// Verify service account subject
		var found bool
		for _, objTuples := range tuples {
			for _, tuple := range objTuples {
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeServiceAccount, sa.UID, "") {
					found = true
					break
				}
			}
		}
		assert.True(t, found, "Should find service account tuple")
	})

	t.Run("should collect managed permissions for teams", func(t *testing.T) {
		env := setupTestEnv(t)

		team1 := createTeam(t, env, "team1", 1)
		roleUID := createRole(t, env, "managed:dashboard:uid1:permissions", 1)
		addTeamRole(t, env, team1.ID, roleUID, 1)
		addPermission(t, env, roleUID, "dashboards:read", "dashboards", "uid1")

		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)

		// Verify team subject
		var found bool
		for _, objTuples := range tuples {
			for _, tuple := range objTuples {
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, zanzana.RelationTeamMember) {
					found = true
					break
				}
			}
		}
		assert.True(t, found, "Should find team tuple")
	})

	t.Run("should collect managed permissions for basic roles", func(t *testing.T) {
		env := setupTestEnv(t)

		roleUID := createRole(t, env, "managed:dashboard:uid1:permissions", 1)
		addBuiltinRole(t, env, roleUID, "Admin", 1)
		addPermission(t, env, roleUID, "dashboards:read", "dashboards", "uid1")

		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)
	})

	t.Run("should filter by kind", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		roleUID1 := createRole(t, env, "managed:dashboard:uid1:permissions", 1)
		roleUID2 := createRole(t, env, "managed:folder:uid2:permissions", 1)
		addUserRole(t, env, user1.ID, roleUID1, 1)
		addUserRole(t, env, user1.ID, roleUID2, 1)
		addPermission(t, env, roleUID1, "dashboards:read", "dashboards", "uid1")
		addPermission(t, env, roleUID2, "folders:read", "folders", "uid2")

		// Collect only dashboards
		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		// Should only have dashboard tuples
		for _, objTuples := range tuples {
			for _, tuple := range objTuples {
				assert.NotContains(t, tuple.Object, "folders")
			}
		}
	})

	t.Run("should return empty for no managed permissions", func(t *testing.T) {
		env := setupTestEnv(t)

		collector := managedPermissionsCollector(env.db, "dashboards")
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Empty(t, tuples)
	})
}

func TestIntegrationRoleBindingsCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect user role bindings", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		roleUID := createRole(t, env, "custom-role", 1)
		addUserRole(t, env, user1.ID, roleUID, 1)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)

		roleObject := zanzana.NewTupleEntry(zanzana.TypeRole, roleUID, "")
		require.Contains(t, tuples, roleObject)

		roleTuples := tuples[roleObject]
		require.NotEmpty(t, roleTuples)

		var found bool
		for _, tuple := range roleTuples {
			if tuple.User == zanzana.NewTupleEntry(zanzana.TypeUser, user1.UID, "") &&
				tuple.Relation == zanzana.RelationAssignee {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("should collect team role bindings", func(t *testing.T) {
		env := setupTestEnv(t)

		team1 := createTeam(t, env, "team1", 1)
		roleUID := createRole(t, env, "custom-role", 1)
		addTeamRole(t, env, team1.ID, roleUID, 1)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)

		roleObject := zanzana.NewTupleEntry(zanzana.TypeRole, roleUID, "")
		roleTuples := tuples[roleObject]

		var found bool
		for _, tuple := range roleTuples {
			if tuple.User == zanzana.NewTupleEntry(zanzana.TypeTeam, team1.UID, zanzana.RelationTeamMember) {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("should collect service account role bindings", func(t *testing.T) {
		env := setupTestEnv(t)

		sa := createUser(t, env, "sa1", 1, true)
		roleUID := createRole(t, env, "custom-role", 1)
		addUserRole(t, env, sa.ID, roleUID, 1)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		var found bool
		for _, roleTuples := range tuples {
			for _, tuple := range roleTuples {
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeServiceAccount, sa.UID, "") {
					found = true
					break
				}
			}
		}
		assert.True(t, found)
	})

	t.Run("should filter out managed roles", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		customRole := createRole(t, env, "custom-role", 1)
		managedRole := createRole(t, env, "managed:dashboard:permissions", 1)
		addUserRole(t, env, user1.ID, customRole, 1)
		addUserRole(t, env, user1.ID, managedRole, 1)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		// Should have custom role
		customRoleObject := zanzana.NewTupleEntry(zanzana.TypeRole, customRole, "")
		require.Contains(t, tuples, customRoleObject)

		// Should NOT have managed role
		managedRoleObject := zanzana.NewTupleEntry(zanzana.TypeRole, managedRole, "")
		require.NotContains(t, tuples, managedRoleObject)
	})

	t.Run("should include global roles (org_id=0)", func(t *testing.T) {
		env := setupTestEnv(t)

		user1 := createUser(t, env, "user1", 1, false)
		globalRole := createRole(t, env, "global-role", 0)
		addUserRole(t, env, user1.ID, globalRole, 0)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		globalRoleObject := zanzana.NewTupleEntry(zanzana.TypeRole, globalRole, "")
		require.Contains(t, tuples, globalRoleObject)
	})

	t.Run("should return empty for no role bindings", func(t *testing.T) {
		env := setupTestEnv(t)

		collector := roleBindingsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Empty(t, tuples)
	})
}

func TestIntegrationRolePermissionsCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should collect role permissions", func(t *testing.T) {
		env := setupTestEnv(t)

		roleUID := createRole(t, env, "custom-role", 1)
		addPermission(t, env, roleUID, "dashboards:read", "dashboards", "uid1")

		collector := rolePermissionsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)
	})

	t.Run("should filter out managed roles", func(t *testing.T) {
		env := setupTestEnv(t)

		customRole := createRole(t, env, "custom-role", 1)
		managedRole := createRole(t, env, "managed:dashboard:permissions", 1)
		addPermission(t, env, customRole, "dashboards:read", "dashboards", "uid1")
		addPermission(t, env, managedRole, "dashboards:read", "dashboards", "uid2")

		collector := rolePermissionsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		// Should only have custom role permissions
		foundCustom := false
		foundManaged := false
		for _, objTuples := range tuples {
			for _, tuple := range objTuples {
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeRole, customRole, zanzana.RelationAssignee) {
					foundCustom = true
				}
				if tuple.User == zanzana.NewTupleEntry(zanzana.TypeRole, managedRole, zanzana.RelationAssignee) {
					foundManaged = true
				}
			}
		}
		assert.True(t, foundCustom, "Should find custom role permissions")
		assert.False(t, foundManaged, "Should not find managed role permissions")
	})

	t.Run("should include global role permissions (org_id=0)", func(t *testing.T) {
		env := setupTestEnv(t)

		globalRole := createRole(t, env, "global-role", 0)
		addPermission(t, env, globalRole, "dashboards:read", "dashboards", "uid1")

		collector := rolePermissionsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.NotEmpty(t, tuples)
	})

	t.Run("should return empty for no permissions", func(t *testing.T) {
		env := setupTestEnv(t)

		collector := rolePermissionsCollector(env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)
		require.Empty(t, tuples)
	})
}

func TestIntegrationAnonymousRoleBindingsCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("should return object with empty tuples when org doesn't match", func(t *testing.T) {
		env := setupTestEnv(t)

		cfg := setting.NewCfg()
		cfg.Anonymous.Enabled = true
		cfg.Anonymous.OrgName = "different-org"
		cfg.Anonymous.OrgRole = "Viewer"

		collector := anonymousRoleBindingsCollector(cfg, env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		// Should have object set but no tuples
		roleObject := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole("Viewer"), "")
		require.Contains(t, tuples, roleObject)

		roleTuples := tuples[roleObject]
		require.Empty(t, roleTuples)
	})

	t.Run("should handle non-existent org gracefully", func(t *testing.T) {
		env := setupTestEnv(t)

		cfg := setting.NewCfg()
		cfg.Anonymous.Enabled = true
		cfg.Anonymous.OrgName = "non-existent-org"
		cfg.Anonymous.OrgRole = "Viewer"

		collector := anonymousRoleBindingsCollector(cfg, env.db)
		tuples, err := collector(env.ctx, 1)

		require.NoError(t, err)

		roleObject := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole("Viewer"), "")
		require.Contains(t, tuples, roleObject)

		roleTuples := tuples[roleObject]
		require.Empty(t, roleTuples)
	})
}

func TestZanzanaCollector(t *testing.T) {
	t.Run("should collect tuples for single relation", func(t *testing.T) {
		mockClient := new(mockZanzanaClient)

		tuples := []*authzextv1.Tuple{
			{
				Key: &authzextv1.TupleKey{
					User:     "user:user1",
					Relation: "member",
					Object:   "team:team1",
				},
			},
		}

		mockClient.On("Read", mock.Anything, mock.MatchedBy(func(req *authzextv1.ReadRequest) bool {
			return req.TupleKey.Object == "team:team1" && req.TupleKey.Relation == "member"
		})).Return(&authzextv1.ReadResponse{
			Tuples:            tuples,
			ContinuationToken: "",
		}, nil)

		collector := zanzanaCollector([]string{"member"})
		result, err := collector(context.Background(), mockClient, "team:team1", "org:1")

		require.NoError(t, err)
		require.Len(t, result, 1)

		mockClient.AssertExpectations(t)
	})

	t.Run("should collect tuples for multiple relations", func(t *testing.T) {
		mockClient := new(mockZanzanaClient)

		memberTuples := []*authzextv1.Tuple{
			{
				Key: &authzextv1.TupleKey{
					User:     "user:user1",
					Relation: "member",
					Object:   "team:team1",
				},
			},
		}

		adminTuples := []*authzextv1.Tuple{
			{
				Key: &authzextv1.TupleKey{
					User:     "user:user2",
					Relation: "admin",
					Object:   "team:team1",
				},
			},
		}

		mockClient.On("Read", mock.Anything, mock.MatchedBy(func(req *authzextv1.ReadRequest) bool {
			return req.TupleKey.Relation == "member"
		})).Return(&authzextv1.ReadResponse{
			Tuples:            memberTuples,
			ContinuationToken: "",
		}, nil)

		mockClient.On("Read", mock.Anything, mock.MatchedBy(func(req *authzextv1.ReadRequest) bool {
			return req.TupleKey.Relation == "admin"
		})).Return(&authzextv1.ReadResponse{
			Tuples:            adminTuples,
			ContinuationToken: "",
		}, nil)

		collector := zanzanaCollector([]string{"member", "admin"})
		result, err := collector(context.Background(), mockClient, "team:team1", "org:1")

		require.NoError(t, err)
		require.Len(t, result, 2)

		mockClient.AssertExpectations(t)
	})

	t.Run("should handle pagination with continuation token", func(t *testing.T) {
		mockClient := new(mockZanzanaClient)

		firstPage := []*authzextv1.Tuple{
			{
				Key: &authzextv1.TupleKey{
					User:     "user:user1",
					Relation: "member",
					Object:   "team:team1",
				},
			},
		}

		secondPage := []*authzextv1.Tuple{
			{
				Key: &authzextv1.TupleKey{
					User:     "user:user2",
					Relation: "member",
					Object:   "team:team1",
				},
			},
		}

		// First call returns continuation token
		mockClient.On("Read", mock.Anything, mock.MatchedBy(func(req *authzextv1.ReadRequest) bool {
			return req.ContinuationToken == ""
		})).Return(&authzextv1.ReadResponse{
			Tuples:            firstPage,
			ContinuationToken: "token1",
		}, nil).Once()

		// Second call with continuation token
		mockClient.On("Read", mock.Anything, mock.MatchedBy(func(req *authzextv1.ReadRequest) bool {
			return req.ContinuationToken == "token1"
		})).Return(&authzextv1.ReadResponse{
			Tuples:            secondPage,
			ContinuationToken: "",
		}, nil).Once()

		collector := zanzanaCollector([]string{"member"})
		result, err := collector(context.Background(), mockClient, "team:team1", "org:1")

		require.NoError(t, err)
		require.Len(t, result, 2)

		mockClient.AssertExpectations(t)
	})

	t.Run("should return empty for no tuples", func(t *testing.T) {
		mockClient := new(mockZanzanaClient)

		mockClient.On("Read", mock.Anything, mock.Anything).Return(&authzextv1.ReadResponse{
			Tuples:            []*authzextv1.Tuple{},
			ContinuationToken: "",
		}, nil)

		collector := zanzanaCollector([]string{"member"})
		result, err := collector(context.Background(), mockClient, "team:team1", "org:1")

		require.NoError(t, err)
		require.Empty(t, result)

		mockClient.AssertExpectations(t)
	})

	t.Run("should handle client error", func(t *testing.T) {
		mockClient := new(mockZanzanaClient)

		mockClient.On("Read", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("client error"))

		collector := zanzanaCollector([]string{"member"})
		_, err := collector(context.Background(), mockClient, "team:team1", "org:1")

		require.Error(t, err)

		mockClient.AssertExpectations(t)
	})
}
