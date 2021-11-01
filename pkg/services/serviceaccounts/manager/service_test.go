package manager

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_DeleteServiceAccount(t *testing.T) {
	store := database.NewServiceAccountsStore(sqlstore.InitTestDB(t))
	svc := setupTestService(t, store)
	ctx := context.Background()

	t.Run("should delete service account", func(t *testing.T) {
		testcases := []struct {
			callMethod string
			statusCode int
		}{
			{
				callMethod: "GET",
				statusCode: http.StatusAccepted,
			},
		}
		for _, tc := range testcases {
		}
	})
}

func SetupTestService(tb testing.TB, db *sqlstore.SQLStore) *ServiceAccountsService {
	if db == nil {
		return setupTestService(tb, fakes.NewFakeSecretsStore())
	}
	return setupTestService(tb, database.ProvideSecretsStore(db))
}

func setupTestService(tb testing.TB, store database.ServiceAccountsStoreImpl) *ServiceAccountsService {
	tb.Helper()
	featureToggle := map[string]bool{
		"service-accounts": true,
	}
	cfg := setting.NewCfg()
	cfg.FeatureToggles = featureToggle

	return ProvideServiceAccountsService(
		cfg,
		store,
	)
}
