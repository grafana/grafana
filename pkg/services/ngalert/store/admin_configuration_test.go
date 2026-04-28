package store

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUpdateAdminConfiguration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	sendTo := ngmodels.ExternalAlertmanagers

	t.Run("insert when no config exists", func(t *testing.T) {
		err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:        1,
				SendAlertsTo: &sendTo,
			},
		})
		require.NoError(t, err)

		cfg, err := store.GetAdminConfiguration(1)
		require.NoError(t, err)
		require.Equal(t, ngmodels.ExternalAlertmanagers, *cfg.SendAlertsTo)
	})

	t.Run("update existing config does not affect other orgs", func(t *testing.T) {
		// Create configs for two more orgs.
		for _, orgID := range []int64{2, 3} {
			err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
				AdminConfiguration: &ngmodels.AdminConfiguration{
					OrgID:        orgID,
					SendAlertsTo: &sendTo,
				},
			})
			require.NoError(t, err)
		}

		// Update org 2 — this triggered the missing-WHERE bug when multiple orgs existed.
		internal := ngmodels.InternalAlertmanager
		err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:        2,
				SendAlertsTo: &internal,
			},
		})
		require.NoError(t, err)

		// Org 2 should reflect the update.
		cfg2, err := store.GetAdminConfiguration(2)
		require.NoError(t, err)
		require.Equal(t, ngmodels.InternalAlertmanager, *cfg2.SendAlertsTo)

		// Org 1 and 3 must be untouched.
		cfg1, err := store.GetAdminConfiguration(1)
		require.NoError(t, err)
		require.Equal(t, ngmodels.ExternalAlertmanagers, *cfg1.SendAlertsTo)

		cfg3, err := store.GetAdminConfiguration(3)
		require.NoError(t, err)
		require.Equal(t, ngmodels.ExternalAlertmanagers, *cfg3.SendAlertsTo)
	})
}
