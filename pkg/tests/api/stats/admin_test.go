package stats

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationAdminStats(t *testing.T) {
	t.Run("with unified alerting enabled", func(t *testing.T) {
		url := grafanaSetup(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		// nolint:gosec
		resp, err := http.Get(url)
		defer func() {
			_ = resp.Body.Close()
		}()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("with legacy alerting enabled", func(t *testing.T) {
		url := grafanaSetup(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: false,
			EnableUnifiedAlerting: false,
			AppModeProduction:     true,
		})

		// nolint:gosec
		resp, err := http.Get(url)
		defer func() {
			_ = resp.Body.Close()
		}()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

// grafanaSetup creates the grafana server, user and returns the URL with credentials of the api/admin/stats endpoint.
func grafanaSetup(t *testing.T, opts testinfra.GrafanaOpts) string {
	t.Helper()

	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, opts)

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Login:          "grafana",
		Password:       "password",
		IsAdmin:        true,
	})

	return fmt.Sprintf("http://%s:%s@%s/api/admin/stats", "grafana", "password", grafanaListedAddr)
}

func createUser(t *testing.T, store *sqlstore.SQLStore, cmd user.CreateUserCommand) int64 {
	t.Helper()

	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(store, store.Cfg)
	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(store, orgService, store.Cfg, nil, nil, quotaService, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}
