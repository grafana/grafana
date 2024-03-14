package test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	usermig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/user"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationServiceAccountMigration(t *testing.T) {
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
