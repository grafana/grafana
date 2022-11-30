package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	/*
		here we test the service as a whole and should probably initialize the service with a proper store
	*/
	store := db.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(store, store.Cfg, quotaService)
	require.Nil(t, err)
	kvStore := kvstore.ProvideService(store)
	orgService, err := orgimpl.ProvideService(store, setting.NewCfg(), quotaService)
	require.Nil(t, err)
	saStore := database.ProvideServiceAccountsStore(store, apiKeyService, kvStore, orgService)
	autoAssignOrg := store.Cfg.AutoAssignOrg
	store.Cfg.AutoAssignOrg = true
	defer func() {
		store.Cfg.AutoAssignOrg = autoAssignOrg
	}()

	orgCmd := &models.CreateOrgCommand{Name: "Some Test Org"}
	err = store.CreateOrg(context.Background(), orgCmd)
	require.Nil(t, err)

	t.Run("should call store function", func(t *testing.T) {
		svcMock := &tests.ServiceAccountMock{Store: saStore, Calls: tests.Calls{}}

		serviceAccountName := "new Service Account"
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := &serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}
		account, err := svcMock.CreateServiceAccount(context.Background(), orgCmd.Result.Id, saForm)
		require.NoError(t, err)
		err = svcMock.DeleteServiceAccount(context.Background(), orgCmd.Result.Id, account.Id)
		require.NoError(t, err)
		assert.Len(t, svcMock.Calls.DeleteServiceAccount, 1)
	})
}
