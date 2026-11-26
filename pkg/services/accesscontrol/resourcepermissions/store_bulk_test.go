package resourcepermissions

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// bulkTeamState is the database state a team membership write affects, keyed
// by user login so that runs on different databases can be compared.
type bulkTeamState struct {
	members     map[string]string   // login -> team_member permission
	permissions map[string][]string // login -> sorted actions on the team scope
	userRoles   map[string]int      // login -> number of managed user role assignments
	returned    []string            // "login:actions" per returned permission, in command order
}

// Runs each scenario through the per-user loop and through the bulk path on
// fresh databases, and requires both to leave the same state behind.
func TestIntegrationService_SetPermissions_BulkUserWrites(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type scenario struct {
		desc string
		// users is the number of users to create; they are referred to by index.
		users int
		// existing memberships of the team, set up before the write.
		existing map[int]string
		// otherTeam users are members of a second team, so they already have a managed role.
		otherTeam []int
		// commands to apply, as user index -> permission, in order.
		commands  [][2]any
		expectErr bool
	}

	seq := func(n int, permission string) [][2]any {
		cmds := make([][2]any, 0, n)
		for i := range n {
			cmds = append(cmds, [2]any{i, permission})
		}
		return cmds
	}

	scenarios := []scenario{
		{
			desc:      "fill an empty team",
			users:     6,
			otherTeam: []int{2},
			commands:  [][2]any{{0, "Member"}, {1, "Member"}, {2, "Member"}, {3, "Admin"}, {4, "Member"}, {5, "Admin"}},
		},
		{
			desc:      "add, remove and change members of an existing team",
			users:     7,
			existing:  map[int]string{0: "Member", 1: "Member", 2: "Admin", 3: "Member"},
			otherTeam: []int{4},
			commands:  [][2]any{{0, ""}, {1, "Admin"}, {2, "Member"}, {4, "Member"}, {5, "Admin"}, {6, "Member"}},
		},
		{
			desc:      "removing a user that isn't a member fails",
			users:     3,
			existing:  map[int]string{0: "Member"},
			commands:  [][2]any{{0, ""}, {1, ""}, {2, "Member"}},
			expectErr: true,
		},
		{
			desc:     "more users than fit in one lookup or insert",
			users:    520,
			existing: map[int]string{0: "Admin", 1: "Member"},
			commands: seq(520, "Member"),
		},
	}

	run := func(t *testing.T, bulk bool, sc scenario) (bulkTeamState, int, int, error) {
		service, usrSvc, teamSvc, _ := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures(), false)
		dbHelper, err := legacysql.NewDatabaseProvider(service.sqlStore)(context.Background())
		require.NoError(t, err)

		var userHookCalls, usersHookCalls int
		service.options.OnSetUser = func(sess *db.Session, orgID int64, usr accesscontrol.User, resourceID, permission string) error {
			userHookCalls++
			teamID, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "":
				return teamimpl.RemoveTeamMemberHook(dbHelper, sess, &team.RemoveTeamMemberCommand{OrgID: orgID, UserID: usr.ID, TeamID: teamID})
			case "Admin":
				return teamimpl.AddOrUpdateTeamMemberHook(dbHelper, sess, usr.ID, orgID, teamID, usr.IsExternal, team.PermissionTypeAdmin)
			default:
				return teamimpl.AddOrUpdateTeamMemberHook(dbHelper, sess, usr.ID, orgID, teamID, usr.IsExternal, team.PermissionTypeMember)
			}
		}
		service.options.OnSetUsers = func(sess *db.Session, orgID int64, users []accesscontrol.User, resourceID, permission string) error {
			usersHookCalls++
			teamID, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "":
				ids := make([]int64, 0, len(users))
				for _, u := range users {
					ids = append(ids, u.ID)
				}
				return teamimpl.RemoveTeamMembersHook(dbHelper, sess, orgID, teamID, ids)
			case "Admin":
				return teamimpl.AddOrUpdateTeamMembersHook(dbHelper, sess, orgID, teamID, users, team.PermissionTypeAdmin)
			default:
				return teamimpl.AddOrUpdateTeamMembersHook(dbHelper, sess, orgID, teamID, users, team.PermissionTypeMember)
			}
		}

		ctx := context.Background()
		created, err := teamSvc.CreateTeam(ctx, &team.CreateTeamCommand{Name: "team", OrgID: 1})
		require.NoError(t, err)
		other, err := teamSvc.CreateTeam(ctx, &team.CreateTeamCommand{Name: "other", OrgID: 1})
		require.NoError(t, err)
		teamID := strconv.FormatInt(created.ID, 10)

		userIDs := make([]int64, sc.users)
		for i := range sc.users {
			u, err := usrSvc.Create(ctx, &user.CreateUserCommand{Login: fmt.Sprintf("user-%03d", i), OrgID: 1})
			require.NoError(t, err)
			userIDs[i] = u.ID
		}

		// Seed through the per-user path; the flag isn't set yet.
		for i, permission := range sc.existing {
			_, err := service.SetUserPermission(ctx, 1, accesscontrol.User{ID: userIDs[i]}, teamID, permission)
			require.NoError(t, err)
		}
		for _, i := range sc.otherTeam {
			_, err := service.SetUserPermission(ctx, 1, accesscontrol.User{ID: userIDs[i]}, strconv.FormatInt(other.ID, 10), "Member")
			require.NoError(t, err)
		}
		userHookCalls = 0

		setOpenFeatureFlag(t, featuremgmt.FlagResourcePermissionsBulkUserWrites, bulk)

		commands := make([]accesscontrol.SetResourcePermissionCommand, 0, len(sc.commands))
		for _, c := range sc.commands {
			commands = append(commands, accesscontrol.SetResourcePermissionCommand{UserID: userIDs[c[0].(int)], Permission: c[1].(string)})
		}
		returned, setErr := service.SetPermissions(ctx, 1, teamID, commands...)

		state := readBulkTeamState(t, service.sqlStore, created.ID, returned)
		return state, userHookCalls, usersHookCalls, setErr
	}

	for _, sc := range scenarios {
		t.Run(sc.desc, func(t *testing.T) {
			var loop, bulk bulkTeamState
			var loopErr, bulkErr error

			t.Run("loop", func(t *testing.T) {
				var userCalls, usersCalls int
				loop, userCalls, usersCalls, loopErr = run(t, false, sc)
				require.Zero(t, usersCalls, "the bulk hook must not run with the flag disabled")
				if !sc.expectErr {
					require.Equal(t, len(sc.commands), userCalls)
				}
			})
			t.Run("bulk", func(t *testing.T) {
				var userCalls, usersCalls int
				bulk, userCalls, usersCalls, bulkErr = run(t, true, sc)
				require.Zero(t, userCalls, "the per-user hook must not run on the bulk path")
				require.NotZero(t, usersCalls)
			})

			if sc.expectErr {
				require.Error(t, loopErr)
				require.Error(t, bulkErr)
				require.ErrorIs(t, bulkErr, team.ErrTeamMemberNotFound)
			} else {
				require.NoError(t, loopErr)
				require.NoError(t, bulkErr)
				require.Equal(t, loop.returned, bulk.returned)
			}
			require.Equal(t, loop.members, bulk.members)
			require.Equal(t, loop.permissions, bulk.permissions)
			require.Equal(t, loop.userRoles, bulk.userRoles)
		})
	}
}

func readBulkTeamState(t *testing.T, sql db.DB, teamID int64, returned []accesscontrol.ResourcePermission) bulkTeamState {
	t.Helper()

	state := bulkTeamState{
		members:     map[string]string{},
		permissions: map[string][]string{},
		userRoles:   map[string]int{},
	}
	userTable := sql.GetDialect().Quote("user")
	scope := accesscontrol.Scope("teams", "id", strconv.FormatInt(teamID, 10))

	err := sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		var members []struct {
			Login      string
			Permission int
		}
		if err := sess.SQL(`SELECT u.login AS login, tm.permission AS permission FROM team_member tm INNER JOIN `+userTable+` u ON u.id = tm.user_id WHERE tm.team_id = ?`, teamID).Find(&members); err != nil {
			return err
		}
		for _, m := range members {
			state.members[m.Login] = team.PermissionType(m.Permission).String()
		}

		var permissions []struct {
			Login  string
			Action string
		}
		if err := sess.SQL(`SELECT u.login AS login, p.action AS action FROM permission p
			INNER JOIN user_role ur ON ur.role_id = p.role_id
			INNER JOIN `+userTable+` u ON u.id = ur.user_id
			WHERE p.scope = ?`, scope).Find(&permissions); err != nil {
			return err
		}
		for _, p := range permissions {
			state.permissions[p.Login] = append(state.permissions[p.Login], p.Action)
		}
		for login := range state.permissions {
			slices.Sort(state.permissions[login])
		}

		var roles []struct {
			Login string
			Count int
		}
		if err := sess.SQL(`SELECT u.login AS login, COUNT(*) AS count FROM user_role ur
			INNER JOIN role r ON r.id = ur.role_id
			INNER JOIN `+userTable+` u ON u.id = ur.user_id
			WHERE r.name LIKE ?
			GROUP BY u.login`, accesscontrol.ManagedRolePrefix+"users:%").Find(&roles); err != nil {
			return err
		}
		for _, r := range roles {
			state.userRoles[r.Login] = r.Count
		}
		return nil
	})
	require.NoError(t, err)

	for _, p := range returned {
		actions := slices.Clone(p.Actions)
		slices.Sort(actions)
		state.returned = append(state.returned, fmt.Sprintf("%s:%v", p.UserLogin, actions))
	}

	return state
}

func TestStore_SetUserResourcePermissions_RejectsInvalidCommands(t *testing.T) {
	cmd := func(userID int64, resourceID string) SetResourcePermissionsCommand {
		return SetResourcePermissionsCommand{
			User:                         accesscontrol.User{ID: userID},
			SetResourcePermissionCommand: SetResourcePermissionCommand{Resource: "teams", ResourceAttribute: "id", ResourceID: resourceID},
		}
	}

	tests := []struct {
		desc     string
		commands []SetResourcePermissionsCommand
	}{
		{desc: "duplicate user", commands: []SetResourcePermissionsCommand{cmd(1, "1"), cmd(1, "1")}},
		{desc: "different resources", commands: []SetResourcePermissionsCommand{cmd(1, "1"), cmd(2, "2")}},
		{desc: "team command", commands: []SetResourcePermissionsCommand{cmd(1, "1"), {TeamID: 1, SetResourcePermissionCommand: cmd(0, "1").SetResourcePermissionCommand}}},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			require.ErrorIs(t, validateBulkUserCommands(tt.commands), errInvalidBulkUserCommands)
		})
	}
}
