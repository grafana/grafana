package commands

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

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
			// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
			if sqlStore.GetDialect().DriverName() != "mysql" {
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
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)

			// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
			if sqlStore.GetDialect().DriverName() != "mysql" {
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
				r := ConflictResolver{Users: m}
				r.BuildConflictBlocks(fmt.Sprintf)
				require.Equal(t, tc.wantedNumberOfUsers, len(r.Blocks[tc.expectedBlock]))
				require.Equal(t, true, r.DiscardedBlocks[tc.wantDiscardedBlock])
			}
		})
	}
}

func TestGenerateConflictingUsersFile(t *testing.T) {
	type testListConflictingUsers struct {
		desc               string
		users              []user.User
		wantDiscardedBlock string
		want               string
	}
	testOrgID := 1
	testCases := []testListConflictingUsers{
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
			want: `conflict: ldap-editor
+ id: 1, email: ldap-editor, login: ldap-editor
- id: 2, email: LDAP-EDITOR, login: LDAP-EDITOR
- id: 3, email: No confli, login: LDAP-editor
`,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Restore after destructive operation
			sqlStore := sqlstore.InitTestDB(t)
			// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
			if sqlStore.GetDialect().DriverName() != "mysql" {
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
				r := ConflictResolver{Users: m}
				r.BuildConflictBlocks(fmt.Sprintf)
				if tc.wantDiscardedBlock != "" {
					require.Equal(t, true, r.DiscardedBlocks[tc.wantDiscardedBlock])
				}
				if tc.want != "" {
					fileString := r.ToStringPresentation()
					require.Equal(t, tc.want, fileString)
				}
			}
		})
	}
}

func TestMarshalConflictUser(t *testing.T) {
	// TODO: add more testcases
	testCases := []struct {
		name         string
		inputRow     string
		expectedUser ConflictingUser
	}{{
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
	}}

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
