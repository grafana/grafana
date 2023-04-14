package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

type TestUser struct {
	Name             string
	Role             string
	Login            string
	IsServiceAccount bool
}

type TestApiKey struct {
	Name             string
	Role             org.RoleType
	OrgId            int64
	Key              string
	IsExpired        bool
	ServiceAccountID *int64
}

func SetupUserServiceAccount(t *testing.T, sqlStore *sqlstore.SQLStore, testUser TestUser) *user.User {
	role := string(org.RoleViewer)
	if testUser.Role != "" {
		role = testUser.Role
	}

	quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	org, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{
		Name: "test org",
	})
	require.NoError(t, err)

	u1, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
		Login:            testUser.Login,
		IsServiceAccount: testUser.IsServiceAccount,
		DefaultOrgRole:   role,
		Name:             testUser.Name,
		OrgID:            org.ID,
	})
	require.NoError(t, err)
	return u1
}

func SetupApiKey(t *testing.T, sqlStore *sqlstore.SQLStore, testKey TestApiKey) *apikey.APIKey {
	role := org.RoleViewer
	if testKey.Role != "" {
		role = testKey.Role
	}

	addKeyCmd := &apikey.AddCommand{
		Name:             testKey.Name,
		Role:             role,
		OrgID:            testKey.OrgId,
		ServiceAccountID: testKey.ServiceAccountID,
	}

	if testKey.Key != "" {
		addKeyCmd.Key = testKey.Key
	} else {
		addKeyCmd.Key = "secret"
	}

	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	key, err := apiKeyService.AddAPIKey(context.Background(), addKeyCmd)
	require.NoError(t, err)

	if testKey.IsExpired {
		err := sqlStore.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
			// Force setting expires to time before now to make key expired
			var expires int64 = 1
			expiringKey := apikey.APIKey{Expires: &expires}
			rowsAffected, err := sess.ID(key.ID).Update(&expiringKey)
			require.Equal(t, int64(1), rowsAffected)
			return err
		})
		require.NoError(t, err)
	}

	return key
}

func SetupMockAccesscontrol(t *testing.T,
	userpermissionsfunc func(c context.Context, siu *user.SignedInUser, opt accesscontrol.Options) ([]accesscontrol.Permission, error),
	disableAccessControl bool) *accesscontrolmock.Mock {
	t.Helper()
	acmock := accesscontrolmock.New()
	if disableAccessControl {
		acmock = acmock.WithDisabled()
	}
	acmock.GetUserPermissionsFunc = userpermissionsfunc
	return acmock
}
