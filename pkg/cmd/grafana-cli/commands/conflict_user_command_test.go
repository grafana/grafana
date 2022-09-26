package commands

import (
	"context"
	"fmt"
	"os"
	"sort"

	"testing"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
const ignoredDatabase = "mysql"

func TestBuildConflictBlock(t *testing.T) {
	type testBuildConflictBlock struct {
		desc                string
		users               []user.User
		expectedBlock       string
		wantDiscardedBlock  string
		wantedNumberOfUsers int
	}
	testOrgID := 1
	testCases := []testBuildConflictBlock{
		{
			desc: "should get one block with only 3 users",
			users: []user.User{
				{
					Email: "ldap-editor",
					Login: "ldap-editor",
					OrgID: int64(testOrgID),
				},
				{
					Email: "LDAP-EDITOR",
					Login: "LDAP-EDITOR",
					OrgID: int64(testOrgID),
				},
				{
					Email: "overlapping conflict",
					Login: "LDAP-editor",
					OrgID: int64(testOrgID),
				},
				{
					Email: "OVERLAPPING conflict",
					Login: "no conflict",
					OrgID: int64(testOrgID),
				},
			},
			expectedBlock:       "conflict: ldap-editor",
			wantDiscardedBlock:  "conflict: overlapping conflict",
			wantedNumberOfUsers: 3,
		},
		{
			desc: "should get two blocks",
			users: []user.User{
				{
					Email: "test",
					Login: "test",
					OrgID: int64(testOrgID),
				},
				{
					Email: "TEST",
					Login: "TEST",
					OrgID: int64(testOrgID),
				},
				{
					Email: "test2",
					Login: "test2",
					OrgID: int64(testOrgID),
				},
				{
					Email: "TEST2",
					Login: "TEST2",
					OrgID: int64(testOrgID),
				},
			},
			expectedBlock:       "conflict: test",
			wantedNumberOfUsers: 2,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)

			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				for _, u := range tc.users {
					cmd := user.CreateUserCommand{
						Email: u.Email,
						Name:  u.Name,
						Login: u.Login,
						OrgID: int64(testOrgID),
					}
					_, err := sqlStore.CreateUser(context.Background(), cmd)
					require.NoError(t, err)
				}
				m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				r := ConflictResolver{}
				r.BuildConflictBlocks(m, fmt.Sprintf)
				require.Equal(t, tc.wantedNumberOfUsers, len(r.Blocks[tc.expectedBlock]))
				if tc.wantDiscardedBlock != "" {
					require.Equal(t, true, r.DiscardedBlocks[tc.wantDiscardedBlock])
				}
			}
		})
	}
}

func TestBuildConflictBlockFromFileRepresentation(t *testing.T) {
	type testBuildConflictBlock struct {
		desc                string
		users               []user.User
		fileString          string
		expectedBlocks      []string
		expectedIdsInBlocks map[string][]string
	}
	testOrgID := 1
	m := make(map[string][]string)
	conflict1 := "conflict: test"
	conflict2 := "conflict: test2"
	m[conflict1] = []string{"2", "3"}
	m[conflict2] = []string{"4", "5", "6"}
	testCases := []testBuildConflictBlock{
		{
			desc: "should be able to parse the fileString containing the conflicts",
			users: []user.User{
				{
					Email: "test",
					Login: "test",
					OrgID: int64(testOrgID),
				},
				{
					Email: "TEST",
					Login: "TEST",
					OrgID: int64(testOrgID),
				},
				{
					Email: "test2",
					Login: "test2",
					OrgID: int64(testOrgID),
				},
				{
					Email: "TEST2",
					Login: "TEST2",
					OrgID: int64(testOrgID),
				},
				{
					Email: "Test2",
					Login: "Test2",
					OrgID: int64(testOrgID),
				},
			},
			fileString: `conflict: test
- id: 2, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module:
+ id: 3, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module:
conflict: test2
- id: 4, email: test2, login: test2, last_seen_at: 2012-09-19T08:31:41Z, auth_module:
+ id: 5, email: TEST2, login: TEST2, last_seen_at: 2012-09-19T08:31:51Z, auth_module:
- id: 6, email: Test2, login: Test2, last_seen_at: 2012-09-19T08:32:03Z, auth_module: `,
			expectedBlocks:      []string{"conflict: test", "conflict: test2"},
			expectedIdsInBlocks: m,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)

			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				for _, u := range tc.users {
					cmd := user.CreateUserCommand{
						Email: u.Email,
						Name:  u.Name,
						Login: u.Login,
						OrgID: int64(testOrgID),
					}
					_, err := sqlStore.CreateUser(context.Background(), cmd)
					require.NoError(t, err)
				}

				conflicts, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				r := ConflictResolver{Users: conflicts}
				r.BuildConflictBlocks(conflicts, fmt.Sprintf)
				require.NoError(t, err)
				validErr := getValidConflictUsers(&r, []byte(tc.fileString))
				require.NoError(t, validErr)
				require.Equal(t, len(r.ValidUsers), 5)
				keys := make([]string, 0)
				for k := range r.Blocks {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				require.Equal(t, keys, tc.expectedBlocks)

				// checking for parsing of ids
				conflict1Ids := []string{}
				for _, u := range r.Blocks[conflict1] {
					conflict1Ids = append(conflict1Ids, u.Id)
				}
				require.Equal(t, tc.expectedIdsInBlocks[conflict1], conflict1Ids)
				// checking for parsing of ids
				conflict2Ids := []string{}
				for _, u := range r.Blocks[conflict2] {
					conflict2Ids = append(conflict2Ids, u.Id)
				}
				require.Equal(t, tc.expectedIdsInBlocks[conflict2], conflict2Ids)
			}
		})
	}
}
func TestGetConflictingUsers(t *testing.T) {
	type testListConflictingUsers struct {
		desc    string
		users   []user.User
		want    int
		wantErr error
	}
	testOrgID := 1
	testCases := []testListConflictingUsers{
		{
			desc: "should get login conflicting users",
			users: []user.User{
				{
					Email: "xo",
					Login: "ldap-admin",
					OrgID: int64(testOrgID),
				},
				{
					Email: "ldap-admin",
					Login: "LDAP-ADMIN",
					OrgID: int64(testOrgID),
				},
			},
			want: 2,
		},
		{
			desc: "should get email conflicting users",
			users: []user.User{
				{
					Email: "oauth-admin@example.org",
					Login: "No confli",
					OrgID: int64(testOrgID),
				},
				{
					Email: "oauth-admin@EXAMPLE.ORG",
					Login: "oauth-admin",
					OrgID: int64(testOrgID),
				},
			},
			want: 2,
		},
		// TODO:
		// refactor the sql to get 3 users from this test
		// if this is changed, one needs to correct the filerepresentation
		{
			desc: "should be 5 conflicting users, each conflict gets 2 users",
			users: []user.User{
				{
					Email: "user1",
					Login: "USER_DUPLICATE_TEST_LOGIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "user2",
					Login: "user_duplicate_test_login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "USER2",
					Login: "no-conflict-login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "no-conflict",
					Login: "user_DUPLICATE_test_login",
					OrgID: int64(testOrgID),
				},
			},
			want: 5,
		},
		{
			desc: "should be 8 conflicting users, each conflict gets 2 users",
			users: []user.User{
				{
					Email: "user1",
					Login: "USER_DUPLICATE_TEST_LOGIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "user2",
					Login: "user_duplicate_test_login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "USER2",
					Login: "no-conflict-login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "xo",
					Login: "ldap-admin",
					OrgID: int64(testOrgID),
				},
				{
					Email: "ldap-admin",
					Login: "LDAP-ADMIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "oauth-admin@example.org",
					Login: "No confli",
					OrgID: int64(testOrgID),
				},
				{
					Email: "oauth-admin@EXAMPLE.ORG",
					Login: "oauth-admin",
					OrgID: int64(testOrgID),
				},
			},
			want: 8,
		},
		{
			desc: "should not get service accounts",
			users: []user.User{
				{
					Email:            "sa-x",
					Login:            "sa-x",
					OrgID:            int64(testOrgID),
					IsServiceAccount: true,
				},
				{
					Email:            "sa-X",
					Login:            "sa-X",
					OrgID:            int64(testOrgID),
					IsServiceAccount: true,
				},
			},
			want: 0,
		},
		{
			desc:    "should get nil when no users in database",
			users:   []user.User{},
			want:    0,
			wantErr: nil,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				for _, u := range tc.users {
					cmd := user.CreateUserCommand{
						Email:            u.Email,
						Name:             u.Name,
						Login:            u.Login,
						OrgID:            int64(testOrgID),
						IsServiceAccount: u.IsServiceAccount,
					}
					_, err := sqlStore.CreateUser(context.Background(), cmd)
					require.NoError(t, err)
				}
				m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				require.Equal(t, tc.want, len(m))
				if tc.wantErr != nil {
					require.EqualError(t, err, tc.wantErr.Error())
				}
			}
		})
	}
}

func TestGenerateConflictingUsersFile(t *testing.T) {
	type testGenerateConflictUsers struct {
		desc               string
		users              []user.User
		wantDiscardedBlock string
		wantBlock          string
		wantNumberOfUsers  int
	}
	testOrgID := 1
	testCases := []testGenerateConflictUsers{
		{
			desc: "should get conflicting users",
			users: []user.User{
				{
					Email: "user1",
					Login: "USER_DUPLICATE_TEST_LOGIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "user2",
					Login: "user_duplicate_test_login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "USER2",
					Login: "no-conflict-login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "xo",
					Login: "ldap-admin",
					OrgID: int64(testOrgID),
				},
				{
					Email: "ldap-admin",
					Login: "LDAP-ADMIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "oauth-admin@example.org",
					Login: "No conflict",
					OrgID: int64(testOrgID),
				},
				{
					Email: "oauth-admin@EXAMPLE.ORG",
					Login: "oauth-admin",
					OrgID: int64(testOrgID),
				},
			},
			wantDiscardedBlock: "conflict: user2",
		},
		{
			desc: "should get one block with only 3 users",
			users: []user.User{
				{
					Email: "ldap-editor",
					Login: "ldap-editor",
					OrgID: int64(testOrgID),
				},
				{
					Email: "LDAP-EDITOR",
					Login: "LDAP-EDITOR",
					OrgID: int64(testOrgID),
				},
				{
					Email: "No confli",
					Login: "LDAP-editor",
					OrgID: int64(testOrgID),
				},
			},
			wantBlock:         "conflict: ldap-editor",
			wantNumberOfUsers: 3,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				for _, u := range tc.users {
					cmd := user.CreateUserCommand{
						Email: u.Email,
						Name:  u.Name,
						Login: u.Login,
						OrgID: int64(testOrgID),
					}
					_, err := sqlStore.CreateUser(context.Background(), cmd)
					require.NoError(t, err)
				}
				m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				r := ConflictResolver{}
				r.BuildConflictBlocks(m, fmt.Sprintf)
				if tc.wantDiscardedBlock != "" {
					require.Equal(t, true, r.DiscardedBlocks[tc.wantDiscardedBlock])
				}
				if tc.wantBlock != "" {
					_, exists := r.Blocks[tc.wantBlock]
					require.Equal(t, true, exists)
					require.Equal(t, tc.wantNumberOfUsers, len(r.Blocks[tc.wantBlock]))
				}
			}
		})
	}
}

func TestRunValidateConflictUserFile(t *testing.T) {
	t.Run("should validate file thats gets created", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)
		const testOrgID int64 = 1
		if sqlStore.GetDialect().DriverName() != ignoredDatabase {
			// add additional user with conflicting login where DOMAIN is upper case
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			_, err := sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			_, err = sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			r := ConflictResolver{}
			r.BuildConflictBlocks(conflictUsers, fmt.Sprintf)
			tmpFile, err := generateConflictUsersFile(&r)
			require.NoError(t, err)

			b, err := os.ReadFile(tmpFile.Name())
			require.NoError(t, err)

			validErr := getValidConflictUsers(&r, b)
			require.NoError(t, validErr)
			require.Equal(t, 2, len(r.ValidUsers))
		}
	})
}

func TestMergeUser(t *testing.T) {
	t.Run("should be able to merge user", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)
		teamSvc := teamimpl.ProvideService(sqlStore, setting.NewCfg())
		team1, err := teamSvc.CreateTeam("team1 name", "", 1)
		require.Nil(t, err)
		const testOrgID int64 = 1

		if sqlStore.GetDialect().DriverName() != ignoredDatabase {
			// add additional user with conflicting login where DOMAIN is upper case

			// the order of adding the conflict matters
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Name:  "user name 1",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			userWithLowerCase, err := sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			userWithUpperCase, err := sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)
			// this is the user we want to update to another team
			err = teamSvc.AddTeamMember(userWithUpperCase.ID, testOrgID, team1.Id, false, 0)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			r := ConflictResolver{}
			r.BuildConflictBlocks(conflictUsers, fmt.Sprintf)
			tmpFile, err := generateConflictUsersFile(&r)
			require.NoError(t, err)
			// validation to get newConflicts
			// edited file
			b, err := os.ReadFile(tmpFile.Name())
			require.NoError(t, err)
			validErr := getValidConflictUsers(&r, b)
			require.NoError(t, validErr)
			require.Equal(t, 2, len(r.ValidUsers))

			// test starts here
			err = r.MergeConflictingUsers(context.Background(), sqlStore)
			require.NoError(t, err)

			// user with uppercaseemail should not exist
			query := &models.GetUserByIdQuery{Id: userWithUpperCase.ID}
			err = sqlStore.GetUserById(context.Background(), query)
			require.Error(t, user.ErrUserNotFound, err)

			signedInUser := &user.SignedInUser{OrgID: testOrgID, Permissions: map[int64]map[string][]string{1: {
				ac.ActionTeamsRead:    []string{ac.ScopeTeamsAll},
				ac.ActionOrgUsersRead: []string{ac.ScopeUsersAll},
			}}}

			// test that we have updated the tables with userWithLowerCaseEmail
			q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, SignedInUser: signedInUser}
			err = teamSvc.GetTeamMembers(context.Background(), q1)
			require.NoError(t, err)
			require.Equal(t, 1, len(q1.Result))
			teamMember := q1.Result[0]
			require.Equal(t, userWithLowerCase.ID, teamMember.UserId)
			require.Equal(t, userWithLowerCase.Email, teamMember.Email)

			// test that we have updated the tables with userWithLowerCaseEmail
			q2 := &models.GetOrgUsersQuery{OrgId: testOrgID, User: signedInUser}
			err = sqlStore.GetOrgUsers(context.Background(), q2)
			require.NoError(t, err)
			require.Equal(t, 1, len(q1.Result))
			require.Equal(t, userWithLowerCase.ID, teamMember.UserId)
			require.Equal(t, userWithLowerCase.Email, teamMember.Email)
		}
	})
}

func TestMergeUserFromNewFileInput(t *testing.T) {
	t.Run("should be able to merge users after choosing a different user to keep", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)

		type testBuildConflictBlock struct {
			desc                string
			users               []user.User
			fileString          string
			expectedBlocks      []string
			expectedIdsInBlocks map[string][]string
		}
		testOrgID := 1
		m := make(map[string][]string)
		conflict1 := "conflict: test"
		conflict2 := "conflict: test2"
		m[conflict1] = []string{"2", "3"}
		m[conflict2] = []string{"4", "5", "6"}
		testCases := []testBuildConflictBlock{
			{
				desc: "should be able to parse the fileString containing the conflicts",
				users: []user.User{
					{
						Email: "TEST",
						Login: "TEST",
						OrgID: int64(testOrgID),
					},
					{
						Email: "test",
						Login: "test",
						OrgID: int64(testOrgID),
					},
					{
						Email: "test2",
						Login: "test2",
						OrgID: int64(testOrgID),
					},
					{
						Email: "TEST2",
						Login: "TEST2",
						OrgID: int64(testOrgID),
					},
					{
						Email: "Test2",
						Login: "Test2",
						OrgID: int64(testOrgID),
					},
				},
				fileString: `conflict: test
- id: 1, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module:
+ id: 2, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module:
conflict: test2
- id: 3, email: test2, login: test2, last_seen_at: 2012-09-19T08:31:41Z, auth_module:
+ id: 4, email: TEST2, login: TEST2, last_seen_at: 2012-09-19T08:31:51Z, auth_module:
- id: 5, email: Test2, login: Test2, last_seen_at: 2012-09-19T08:32:03Z, auth_module: `,
				expectedBlocks:      []string{"conflict: test", "conflict: test2"},
				expectedIdsInBlocks: m,
			},
		}
		for _, tc := range testCases {

			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				for _, u := range tc.users {
					cmd := user.CreateUserCommand{
						Email: u.Email,
						Name:  u.Name,
						Login: u.Login,
						OrgID: int64(testOrgID),
					}
					_, err := sqlStore.CreateUser(context.Background(), cmd)
					require.NoError(t, err)
				}
				// add additional user with conflicting login where DOMAIN is upper case
				conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				r := ConflictResolver{}
				r.BuildConflictBlocks(conflictUsers, fmt.Sprintf)
				require.NoError(t, err)
				// validation to get newConflicts
				// edited file
				// b, err := os.ReadFile(tmpFile.Name())
				// mocked file input
				b := tc.fileString
				require.NoError(t, err)
				validErr := getValidConflictUsers(&r, []byte(b))
				require.NoError(t, validErr)
				require.Equal(t, 5, len(r.ValidUsers))

				// test starts here
				err = r.MergeConflictingUsers(context.Background(), sqlStore)
				require.NoError(t, err)
			}
		}
	})
}

func TestMarshalConflictUser(t *testing.T) {
	testCases := []struct {
		name         string
		inputRow     string
		expectedUser ConflictingUser
	}{
		{
			name:     "should be able to marshal expected input row",
			inputRow: "+ id: 4, email: userduplicatetest1@test.com, login: userduplicatetest1@test.com, last_seen_at: 2012-07-26T16:08:11Z, auth_module:",
			expectedUser: ConflictingUser{
				Direction:  "+",
				Id:         "4",
				Email:      "userduplicatetest1@test.com",
				Login:      "userduplicatetest1@test.com",
				LastSeenAt: "2012-07-26T16:08:11Z",
				AuthModule: "",
			},
		},
		{
			name:     "should be able to marshal expected input row",
			inputRow: "+ id: 1, email: userduplicatetest1@test.com, login: user_duplicate_test_1_login",
			expectedUser: ConflictingUser{
				Direction: "+",
				Id:        "1",
				Email:     "userduplicatetest1@test.com",
				Login:     "user_duplicate_test_1_login",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			user := ConflictingUser{}
			err := user.Marshal(tc.inputRow)
			require.NoError(t, err)
			require.Equal(t, tc.expectedUser.Direction, user.Direction)
			require.Equal(t, tc.expectedUser.Id, user.Id)
			require.Equal(t, tc.expectedUser.Email, user.Email)
			require.Equal(t, tc.expectedUser.Login, user.Login)
			require.Equal(t, tc.expectedUser.LastSeenAt, user.LastSeenAt)
		})
	}
}
