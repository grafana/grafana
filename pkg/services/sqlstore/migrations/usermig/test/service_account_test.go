package test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/usermig"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServiceAccountMigration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Run initial migration to have a working DB
	x := setupTestDB(t)

	orgId := 1

	type migrationTestCase struct {
		desc                string
		serviceAccounts     []*user.User
		wantServiceAccounts []*user.User
	}
	testCases := []migrationTestCase{
		{
			desc: "basic case",
			serviceAccounts: []*user.User{
				{
					ID:               1,
					UID:              "u1",
					Name:             "sa-basic",
					Login:            "sa-basic",
					Email:            "sa-basic",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               2,
					UID:              "u2",
					Name:             "sa-basic-admin",
					Login:            "sa-basic-admin",
					Email:            "sa-basic-admin",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    1,
					Login: fmt.Sprintf("sa-%d-basic", orgId),
				},
				{
					ID:    2,
					Login: fmt.Sprintf("sa-%d-basic-admin", orgId),
				},
			},
		},
		{
			desc: "should be able to handle multiple sa",
			serviceAccounts: []*user.User{
				{
					ID:               3,
					UID:              "u3",
					Name:             "sa-doan",
					Login:            "sa-doan",
					Email:            "sa-doan",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               4,
					UID:              "u4",
					Name:             "sa-admin-doan",
					Login:            "sa-admin-doan",
					Email:            "sa-admin-doan",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    3,
					Login: fmt.Sprintf("sa-%d-doan", orgId),
				},
				{
					ID:    4,
					Login: fmt.Sprintf("sa-%d-admin-doan", orgId),
				},
			},
		},
		{
			desc: "duplicate logins across different orgs",
			serviceAccounts: []*user.User{
				{
					ID:               5,
					UID:              "u5",
					Name:             "sa-common",
					Login:            "sa-common@org1.com",
					Email:            "sa-common@org1.com",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               6,
					UID:              "u6",
					Name:             "sa-common",
					Login:            "sa-common@org2.com",
					Email:            "sa-common@org2.com",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    5,
					Login: "sa-1-common@org1.com",
				},
				{
					ID:    6,
					Login: "sa-2-common@org2.com",
				},
			},
		},
		{
			desc: "pre-existing sa- prefix",
			serviceAccounts: []*user.User{
				{
					ID:               7,
					UID:              "u7",
					Name:             "sa-preexisting",
					Login:            "sa-preexisting",
					Email:            "sa-preexisting@org.com",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               8,
					UID:              "u8",
					Name:             "sa-sa-preexisting",
					Login:            "sa-sa-preexisting",
					Email:            "sa-sa-preexisting@org.com",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    7,
					Login: "sa-1-preexisting",
				},
				{
					ID:    8,
					Login: "sa-1-sa-preexisting", // Ensuring only the first 'sa-' is handled
				},
			},
		},
		{
			desc: "extSrv accounts also renamed",
			serviceAccounts: []*user.User{
				{
					ID:               9,
					UID:              "u9",
					Name:             "sa-extsvc-slug",
					Login:            "sa-extsvc-slug",
					Email:            "sa-extsvc-slug@org.com",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               10,
					UID:              "u10",
					Name:             "sa-extsvc-slug2",
					Login:            "sa-extsvc-slug2",
					Email:            "sa-extsvc-slug2@org.com",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    9,
					Login: "sa-1-extsvc-slug",
				},
				{
					ID:    10,
					Login: "sa-2-extsvc-slug2",
				},
			},
		},
		{
			desc: "avoid reapply of migration",
			serviceAccounts: []*user.User{
				{
					ID:               11,
					UID:              "u11",
					Name:             "sa-1-extsvc-bug",
					Login:            "sa-1-extsvc-bug",
					Email:            "sa-1-extsvc-bug@org.com",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               12,
					UID:              "u12",
					Name:             "sa-2-extsvc-bug2",
					Login:            "sa-2-extsvc-bug2",
					Email:            "sa-2-extsvc-bug2@org.com",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    11,
					Login: "sa-1-extsvc-bug",
				},
				{
					ID:    12,
					Login: "sa-2-extsvc-bug2",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration and permissions
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, usermig.AllowSameLoginCrossOrgs)
			require.NoError(t, errDeleteMig)

			// insert service accounts
			serviceAccoutsCount, err := x.Insert(tc.serviceAccounts)
			require.NoError(t, err)
			require.Equal(t, int64(len(tc.serviceAccounts)), serviceAccoutsCount)

			// run the migration
			usermigrator := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("usermigration.test")})
			usermig.AddServiceAccountsAllowSameLoginCrossOrgs(usermigrator)
			errRunningMig := usermigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// Check service accounts
			resultingServiceAccounts := []user.User{}
			err = x.Table("user").Find(&resultingServiceAccounts)
			require.NoError(t, err)

			for i := range tc.wantServiceAccounts {
				for _, sa := range resultingServiceAccounts {
					if sa.ID == tc.wantServiceAccounts[i].ID {
						assert.Equal(t, tc.wantServiceAccounts[i].Login, sa.Login)
					}
				}
			}
		})
	}
}

func TestIntegrationServiceAccountDedupOrgMigration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Run initial migration to have a working DB
	x := setupTestDB(t)

	type migrationTestCase struct {
		desc                string
		serviceAccounts     []*user.User
		wantServiceAccounts []*user.User
	}
	testCases := []migrationTestCase{
		{
			desc: "no change",
			serviceAccounts: []*user.User{
				{
					ID:               1,
					UID:              "u1",
					Name:             "sa-1-nochange",
					Login:            "sa-1-nochange",
					Email:            "sa-1-nochange@example.org",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               2,
					UID:              "u2",
					Name:             "sa-2-nochange",
					Login:            "sa-2-nochange",
					Email:            "sa-2-nochange@example.org",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    1,
					Login: "sa-1-nochange",
				},
				{
					ID:    2,
					Login: "sa-2-nochange",
				},
			},
		},
		{
			desc: "dedup org in login",
			serviceAccounts: []*user.User{
				{
					ID:               3,
					UID:              "u3",
					Name:             "sa-1-dedup",
					Login:            "sa-1-1-dedup",
					Email:            "sa-1-dedup@example.org",
					OrgID:            1,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               4,
					UID:              "u4",
					Name:             "sa-6480-dedup",
					Login:            "sa-6480-6480-dedup",
					Email:            "sa-6480-dedup@example.org",
					OrgID:            6480,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    3,
					Login: "sa-1-dedup",
				},
				{
					ID:    4,
					Login: "sa-6480-dedup",
				},
			},
		},
		{
			desc: "handle conflicts",
			serviceAccounts: []*user.User{
				{
					ID:               5,
					UID:              "u5",
					Name:             "sa-2-conflict",
					Login:            "sa-2-conflict",
					Email:            "sa-2-conflict@example.org",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
				{
					ID:               6,
					UID:              "u6",
					Name:             "sa-2b-conflict",
					Login:            "sa-2-2-conflict",
					Email:            "sa-2b-conflict@example.org",
					OrgID:            2,
					Created:          now,
					Updated:          now,
					IsServiceAccount: true,
				},
			},
			wantServiceAccounts: []*user.User{
				{
					ID:    5,
					Login: "sa-2-conflict",
				},
				{
					ID:    6,
					Login: "sa-2-2-conflict",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration and permissions
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, usermig.DedupOrgInLogin)
			require.NoError(t, errDeleteMig)

			// insert service accounts
			serviceAccoutsCount, err := x.Insert(tc.serviceAccounts)
			require.NoError(t, err)
			require.Equal(t, int64(len(tc.serviceAccounts)), serviceAccoutsCount)

			// run the migration
			usermigrator := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("usermigration.test")})
			usermigrator.AddMigration(usermig.DedupOrgInLogin, &usermig.ServiceAccountsDeduplicateOrgInLogin{})
			errRunningMig := usermigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// Check service accounts
			resultingServiceAccounts := []user.User{}
			err = x.Table("user").Find(&resultingServiceAccounts)
			require.NoError(t, err)

			for i := range tc.wantServiceAccounts {
				for _, sa := range resultingServiceAccounts {
					if sa.ID == tc.wantServiceAccounts[i].ID {
						assert.Equal(t, tc.wantServiceAccounts[i].Login, sa.Login)
					}
				}
			}
		})
	}
}
