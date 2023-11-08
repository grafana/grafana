package orgs

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/stretchr/testify/require"
)

func TestNotificationAsConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var orgService org.Service
	var userService user.Service
	ctx := context.TODO()
	logger := log.New("fake.log")

	t.Run("Testing notification as configuration", func(t *testing.T) {
		setup := func() {
			var err error
			sqlStore = db.InitTestDB(t)
			orgService, err = orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotatest.New(false, nil))
			require.NoError(t, err)

			quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)

			userService, err = userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)

			for i := 1; i <= 3; i++ {
				createdUser, err := userService.Create(ctx, &user.CreateUserCommand{
					Login:        fmt.Sprintf("user%v", i),
					SkipOrgSetup: true,
				})
				require.NoError(t, err)

				_, err = orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: fmt.Sprintf("Org %v", i), UserID: createdUser.ID})
				require.NoError(t, err)
			}
		}

		t.Run("Can read correct properties", func(t *testing.T) {
			setup()

			orgProvisioner := OrgProvisioner{
				log: logger,
				cfgProvider: testConfigReader{
					orgFiles: []*orgFile{
						{
							CreateOrgs: []*orgFromConfig{{
								Name:                     "Org 3",
								InitialAdminLoginOrEmail: "user1",
							}, {
								Name:                     "Org New",
								InitialAdminLoginOrEmail: "user1",
							}},
							DeleteOrgs: []*deleteOrgConfig{{Name: "Org 1"}},
						},
					},
				},
				orgService:  orgService,
				userService: userService,
			}

			orgProvisioner.applyChanges(ctx, "")

			orgDTOs, err := orgService.Search(ctx, &org.SearchOrgsQuery{})
			require.NoError(t, err)
			require.Equal(t, 3, len(orgDTOs))

			// Org 1 deleted
			_, err = orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: "Org 1"})
			require.ErrorIs(t, err, org.ErrOrgNotFound)

			// Org 2 kept
			_, err = orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: "Org 2"})
			require.NoError(t, err)

			// Org 3 kept, user unchanged
			org3, err := orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: "Org 3"})
			require.NoError(t, err)
			orgUserDTOs, err := orgService.GetOrgUsers(ctx, &org.GetOrgUsersQuery{
				OrgID:                    org3.ID,
				DontEnforceAccessControl: true,
			})
			require.NoError(t, err)
			require.Equal(t, 1, len(orgUserDTOs))
			require.Equal(t, "user3", orgUserDTOs[0].Login)

			// Org New added
			orgNew, err := orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: "Org New"})
			require.NoError(t, err)
			orgNewUserDTOs, err := orgService.GetOrgUsers(ctx, &org.GetOrgUsersQuery{
				OrgID:                    orgNew.ID,
				DontEnforceAccessControl: true,
			})
			require.NoError(t, err)
			require.Equal(t, 1, len(orgNewUserDTOs))
			require.Equal(t, "user1", orgNewUserDTOs[0].Login)
		})
	})
}

type testConfigReader struct {
	orgFiles []*orgFile
	err      error
}

func (cr testConfigReader) readConfig(ctx context.Context, path string) ([]*orgFile, error) {
	return cr.orgFiles, cr.err
}
