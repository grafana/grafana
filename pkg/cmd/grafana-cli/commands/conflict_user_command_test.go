package commands

import (
	"context"
	"fmt"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
const ignoredDatabase = migrator.MySQL

func TestBuildConflictBlock(t *testing.T) {
	type testBuildConflictBlock struct {
		desc                string
		users               []user.User
		expectedBlock       string
		wantDiscardedBlock  string
		wantConflictUser    *ConflictingUser
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
			desc: "should get conflict_email true and conflict_login empty string",
			users: []user.User{
				{
					Email: "conflict@email",
					Login: "login",
					OrgID: int64(testOrgID),
				},
				{
					Email: "conflict@EMAIL",
					Login: "plainlogin",
					OrgID: int64(testOrgID),
				},
			},
			expectedBlock:       "conflict: conflict@email",
			wantedNumberOfUsers: 2,
			wantConflictUser:    &ConflictingUser{ConflictEmail: "true", ConflictLogin: ""},
		},
		{
			desc: "should get conflict_email empty string and conflict_login true",
			users: []user.User{
				{
					Email: "regular@email",
					Login: "CONFLICTLOGIN",
					OrgID: int64(testOrgID),
				},
				{
					Email: "regular-no-conflict@email",
					Login: "conflictlogin",
					OrgID: int64(testOrgID),
				},
			},
			expectedBlock:       "conflict: conflictlogin",
			wantedNumberOfUsers: 2,
			wantConflictUser:    &ConflictingUser{ConflictEmail: "", ConflictLogin: "true"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := db.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				userStore := userimpl.ProvideStore(sqlStore, sqlStore.Cfg)
				for _, u := range tc.users {
					u := user.User{
						Email:   u.Email,
						Name:    u.Name,
						Login:   u.Login,
						OrgID:   int64(testOrgID),
						Created: time.Now(),
						Updated: time.Now(),
					}
					// call user store instead of user service so as not to prevent conflicting users
					_, err := userStore.Insert(context.Background(), &u)
					require.NoError(t, err, u)
				}
				m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				r := ConflictResolver{Store: sqlStore}
				r.BuildConflictBlocks(m, fmt.Sprintf)
				require.Equal(t, tc.wantedNumberOfUsers, len(r.Blocks[tc.expectedBlock]))
				if tc.wantDiscardedBlock != "" {
					require.Equal(t, true, r.DiscardedBlocks[tc.wantDiscardedBlock])
				}
				if tc.wantConflictUser != nil {
					for _, u := range m {
						require.Equal(t, tc.wantConflictUser.ConflictEmail, u.ConflictEmail)
						require.Equal(t, tc.wantConflictUser.ConflictLogin, u.ConflictLogin)
					}
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
- id: 2, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module: , conflict_email: true, conflict_login: true
+ id: 3, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module: , conflict_email: true, conflict_login: true
conflict: test2
- id: 4, email: test2, login: test2, last_seen_at: 2012-09-19T08:31:41Z, auth_module: , conflict_email: true, conflict_login: true
+ id: 5, email: TEST2, login: TEST2, last_seen_at: 2012-09-19T08:31:51Z, auth_module: , conflict_email: true, conflict_login: true
- id: 6, email: Test2, login: Test2, last_seen_at: 2012-09-19T08:32:03Z, auth_module: , conflict_email: true, conflict_login: true`,
			expectedBlocks:      []string{"conflict: test", "conflict: test2"},
			expectedIdsInBlocks: map[string][]string{"conflict: test": {"2", "3"}, "conflict: test2": {"4", "5", "6"}},
		},
		{
			desc: "should be able to parse the fileString containing the conflicts 123",
			users: []user.User{
				{
					Email: "saml-misi@example.org",
					Login: "saml-misi",
					OrgID: int64(testOrgID),
				},
				{
					Email: "saml-misi@example",
					Login: "saml-Misi",
					OrgID: int64(testOrgID),
				},
			},
			fileString: `conflict: saml-misi
+ id: 5, email: saml-misi@example.org, login: saml-misi, last_seen_at: 2022-09-22T12:00:49Z, auth_module: auth.saml, conflict_email: , conflict_login: true
- id: 15, email: saml-misi@example, login: saml-Misi, last_seen_at: 2012-09-26T11:31:32Z, auth_module: , conflict_email: , conflict_login: true`,
			expectedBlocks:      []string{"conflict: saml-misi"},
			expectedIdsInBlocks: map[string][]string{"conflict: saml-misi": {"5", "15"}},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := db.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				userStore := userimpl.ProvideStore(sqlStore, sqlStore.Cfg)
				for _, u := range tc.users {
					u := user.User{
						Email:   u.Email,
						Name:    u.Name,
						Login:   u.Login,
						OrgID:   int64(testOrgID),
						Created: time.Now(),
						Updated: time.Now(),
					}
					// call user store instead of user service so as not to prevent conflicting users
					_, err := userStore.Insert(context.Background(), &u)
					require.NoError(t, err)
				}

				conflicts, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				r := ConflictResolver{Users: conflicts, Store: sqlStore}
				r.BuildConflictBlocks(conflicts, fmt.Sprintf)
				require.NoError(t, err)
				validErr := getValidConflictUsers(&r, []byte(tc.fileString))
				require.NoError(t, validErr)

				// test starts here
				keys := make([]string, 0)
				for k := range r.Blocks {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				require.Equal(t, tc.expectedBlocks, keys)

				// we want to validate the ids in the blocks
				for _, block := range tc.expectedBlocks {
					// checking for parsing of ids
					conflictIds := []string{}
					for _, u := range r.Blocks[block] {
						conflictIds = append(conflictIds, u.ID)
					}
					require.Equal(t, tc.expectedIdsInBlocks[block], conflictIds)
				}
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
			sqlStore := db.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				userStore := userimpl.ProvideStore(sqlStore, sqlStore.Cfg)
				for _, u := range tc.users {
					u := user.User{
						Email:            u.Email,
						Name:             u.Name,
						Login:            u.Login,
						OrgID:            int64(testOrgID),
						IsServiceAccount: u.IsServiceAccount,
						Created:          time.Now(),
						Updated:          time.Now(),
					}
					// call user store instead of user service so as not to prevent conflicting users
					_, err := userStore.Insert(context.Background(), &u)
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
		desc                   string
		users                  []user.User
		expectedDiscardedBlock string
		expectedBlocks         []string
		expectedEmailInBlocks  map[string][]string
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
			expectedBlocks: []string{"conflict: ldap-admin", "conflict: user_duplicate_test_login", "conflict: oauth-admin@example.org", "conflict: user2"},
			expectedEmailInBlocks: map[string][]string{
				"conflict: ldap-admin":                {"ldap-admin", "xo"},
				"conflict: user_duplicate_test_login": {"user1", "user2"},
				"conflict: oauth-admin@example.org":   {"oauth-admin@EXAMPLE.ORG", "oauth-admin@example.org"},
				"conflict: user2":                     {"USER2", "user2"},
			},
			expectedDiscardedBlock: "conflict: user2",
		},
		{
			desc: "should get only one block with 3 users",
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
			expectedBlocks:        []string{"conflict: ldap-editor"},
			expectedEmailInBlocks: map[string][]string{"conflict: ldap-editor": {"ldap-editor", "LDAP-EDITOR", "No confli"}},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := db.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				userStore := userimpl.ProvideStore(sqlStore, sqlStore.Cfg)
				for _, u := range tc.users {
					cmd := user.User{
						Email:   u.Email,
						Name:    u.Name,
						Login:   u.Login,
						OrgID:   int64(testOrgID),
						Created: time.Now(),
						Updated: time.Now(),
					}
					// call user store instead of user service so as not to prevent conflicting users
					_, err := userStore.Insert(context.Background(), &cmd)
					require.NoError(t, err)
				}
				m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				r := ConflictResolver{Store: sqlStore}
				r.BuildConflictBlocks(m, fmt.Sprintf)
				if tc.expectedDiscardedBlock != "" {
					require.Equal(t, true, r.DiscardedBlocks[tc.expectedDiscardedBlock])
				}

				// test starts here
				keys := make([]string, 0)
				for k := range r.Blocks {
					keys = append(keys, k)
				}
				expectedBlocks := tc.expectedBlocks
				sort.Strings(keys)
				sort.Strings(expectedBlocks)
				require.Equal(t, expectedBlocks, keys)

				// we want to validate the ids in the blocks
				for _, block := range tc.expectedBlocks {
					// checking for parsing of ids
					conflictEmails := []string{}
					for _, u := range r.Blocks[block] {
						conflictEmails = append(conflictEmails, u.Email)
					}
					expectedEmailsInBlock := tc.expectedEmailInBlocks[block]
					sort.Strings(conflictEmails)
					sort.Strings(expectedEmailsInBlock)
					require.Equal(t, expectedEmailsInBlock, conflictEmails)
				}
			}
		})
	}
}

func TestRunValidateConflictUserFile(t *testing.T) {
	t.Run("should validate file thats gets created", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := db.InitTestDB(t)
		usrSvc := setupTestUserService(t, sqlStore)

		const testOrgID int64 = 1
		if sqlStore.GetDialect().DriverName() != ignoredDatabase {
			// add additional user with conflicting login where DOMAIN is upper case
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			_, err := usrSvc.Create(context.Background(), &dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			_, err = usrSvc.Create(context.Background(), &dupUserEmailcmd)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			r := ConflictResolver{Store: sqlStore}
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

func TestIntegrationMergeUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("should be able to merge user", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := db.InitTestDB(t)
		teamSvc := teamimpl.ProvideService(sqlStore, setting.NewCfg())
		team1, err := teamSvc.CreateTeam("team1 name", "", 1)
		require.Nil(t, err)
		usrSvc := setupTestUserService(t, sqlStore)
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
			_, err := usrSvc.Create(context.Background(), &dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			userWithUpperCase, err := usrSvc.Create(context.Background(), &dupUserEmailcmd)
			require.NoError(t, err)
			// this is the user we want to update to another team
			err = teamSvc.AddTeamMember(userWithUpperCase.ID, testOrgID, team1.ID, false, 0)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			r := ConflictResolver{
				Store:       sqlStore,
				userService: usertest.NewUserServiceFake(),
				ac:          actest.FakeService{},
			}
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
			err = r.MergeConflictingUsers(context.Background())
			require.NoError(t, err)
		}
	})
}

func TestIntegrationMergeUserFromNewFileInput(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("should be able to merge users after choosing a different user to keep", func(t *testing.T) {
		type testBuildConflictBlock struct {
			desc                  string
			users                 []user.User
			fileString            string
			expectedValidationErr error
			expectedBlocks        []string
			expectedIdsInBlocks   map[string][]string
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
- id: 1, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module:, conflict_email: true, conflict_login: true
+ id: 2, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module:, conflict_email: true, conflict_login: true
conflict: test2
- id: 3, email: test2, login: test2, last_seen_at: 2012-09-19T08:31:41Z, auth_module: , conflict_email: true, conflict_login: true
+ id: 4, email: TEST2, login: TEST2, last_seen_at: 2012-09-19T08:31:51Z, auth_module: , conflict_email: true, conflict_login: true
- id: 5, email: Test2, login: Test2, last_seen_at: 2012-09-19T08:32:03Z, auth_module: , conflict_email: true, conflict_login: true`,
				expectedBlocks:      []string{"conflict: test", "conflict: test2"},
				expectedIdsInBlocks: m,
			},
			{
				desc: "should give error for having wrong number of users to keep",
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
				},
				fileString: `conflict: test
+ id: 1, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module:, conflict_email: true, conflict_login: true
+ id: 2, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module:, conflict_email: true, conflict_login: true
`,
				expectedValidationErr: fmt.Errorf("invalid number of users to keep, expected 1, got 2 for block: conflict: test"),
				expectedBlocks:        []string{"conflict: test"},
			},
			{
				desc: "should give error for having wrong character for user",
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
				},
				fileString: `conflict: test
+ id: 1, email: test, login: test, last_seen_at: 2012-09-19T08:31:20Z, auth_module:, conflict_email: true, conflict_login: true
% id: 2, email: TEST, login: TEST, last_seen_at: 2012-09-19T08:31:29Z, auth_module:, conflict_email: true, conflict_login: true
`,
				expectedValidationErr: fmt.Errorf("invalid start character (expected '+,-') found %% for row number 3"),
				expectedBlocks:        []string{"conflict: test"},
			},
		}
		for _, tc := range testCases {
			// Restore after destructive operation
			sqlStore := db.InitTestDB(t)
			if sqlStore.GetDialect().DriverName() != ignoredDatabase {
				userStore := userimpl.ProvideStore(sqlStore, sqlStore.Cfg)
				for _, u := range tc.users {
					cmd := user.User{
						Email:   u.Email,
						Name:    u.Name,
						Login:   u.Login,
						OrgID:   int64(testOrgID),
						Created: time.Now(),
						Updated: time.Now(),
					}
					// call user store instead of user service so as not to prevent conflicting users
					_, err := userStore.Insert(context.Background(), &cmd)
					require.NoError(t, err)
				}
				// add additional user with conflicting login where DOMAIN is upper case
				conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
				require.NoError(t, err)
				userFake := usertest.NewUserServiceFake()
				userFake.ExpectedUser = &user.User{Email: "test", Login: "test", OrgID: int64(testOrgID)}
				r := ConflictResolver{
					Store:       sqlStore,
					userService: userFake,
					ac:          actest.FakeService{},
				}
				r.BuildConflictBlocks(conflictUsers, fmt.Sprintf)
				require.NoError(t, err)
				// validation to get newConflicts
				// edited file
				// b, err := os.ReadFile(tmpFile.Name())
				// mocked file input
				b := tc.fileString
				require.NoError(t, err)
				validErr := getValidConflictUsers(&r, []byte(b))
				if tc.expectedValidationErr != nil {
					require.Equal(t, tc.expectedValidationErr, validErr)
				} else {
					require.NoError(t, validErr)
				}

				// test starts here
				err = r.MergeConflictingUsers(context.Background())
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
			inputRow: "+ id: 4, email: userduplicatetest1@test.com, login: userduplicatetest1, last_seen_at: 2012-07-26T16:08:11Z, auth_module: auth.saml, conflict_email: true, conflict_login: ",
			expectedUser: ConflictingUser{
				Direction:     "+",
				ID:            "4",
				Email:         "userduplicatetest1@test.com",
				Login:         "userduplicatetest1",
				LastSeenAt:    "2012-07-26T16:08:11Z",
				AuthModule:    "auth.saml",
				ConflictEmail: "true",
				ConflictLogin: "",
			},
		},
		{
			name:     "should be able to marshal expected input row",
			inputRow: "+ id: 1, email: userduplicatetest1@test.com, login: user_duplicate_test_1_login, last_seen_at: 2012-07-26T16:08:11Z, auth_module: , conflict_email: , conflict_login: true",
			expectedUser: ConflictingUser{
				Direction:     "+",
				ID:            "1",
				Email:         "userduplicatetest1@test.com",
				Login:         "user_duplicate_test_1_login",
				LastSeenAt:    "2012-07-26T16:08:11Z",
				AuthModule:    "",
				ConflictEmail: "",
				ConflictLogin: "true",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			user := ConflictingUser{}
			err := user.Marshal(tc.inputRow)
			require.NoError(t, err)
			require.Equal(t, tc.expectedUser.Direction, user.Direction)
			require.Equal(t, tc.expectedUser.ID, user.ID)
			require.Equal(t, tc.expectedUser.Email, user.Email)
			require.Equal(t, tc.expectedUser.Login, user.Login)
			require.Equal(t, tc.expectedUser.LastSeenAt, user.LastSeenAt)
			require.Equal(t, tc.expectedUser.ConflictEmail, user.ConflictEmail)
			require.Equal(t, tc.expectedUser.ConflictLogin, user.ConflictLogin)
		})
	}
}

func setupTestUserService(t *testing.T, sqlStore *sqlstore.SQLStore) user.Service {
	t.Helper()
	orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, &quotatest.FakeQuotaService{})
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, &quotatest.FakeQuotaService{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	return usrSvc
}
