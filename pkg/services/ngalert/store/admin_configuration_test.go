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

	uid := "some-mimir-ds-uid"

	t.Run("insert with only ExternalAlertmanagerUID defaults SendAlertsTo to internal", func(t *testing.T) {
		err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:                   10,
				ExternalAlertmanagerUID: &uid,
			},
		})
		require.NoError(t, err)

		cfg, err := store.GetAdminConfiguration(10)
		require.NoError(t, err)
		require.NotNil(t, cfg.ExternalAlertmanagerUID)
		require.Equal(t, uid, *cfg.ExternalAlertmanagerUID)
		require.NotNil(t, cfg.SendAlertsTo)
		require.Equal(t, ngmodels.InternalAlertmanager, *cfg.SendAlertsTo)
	})

	t.Run("UID-only update preserves existing SendAlertsTo", func(t *testing.T) {
		external := ngmodels.ExternalAlertmanagers
		err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:        11,
				SendAlertsTo: &external,
			},
		})
		require.NoError(t, err)

		err = store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:                   11,
				ExternalAlertmanagerUID: &uid,
			},
		})
		require.NoError(t, err)

		cfg, err := store.GetAdminConfiguration(11)
		require.NoError(t, err)
		require.NotNil(t, cfg.SendAlertsTo)
		require.Equal(t, ngmodels.ExternalAlertmanagers, *cfg.SendAlertsTo)
		require.NotNil(t, cfg.ExternalAlertmanagerUID)
		require.Equal(t, uid, *cfg.ExternalAlertmanagerUID)
	})

	t.Run("choice-only update preserves existing UID", func(t *testing.T) {
		err := store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:                   12,
				ExternalAlertmanagerUID: &uid,
			},
		})
		require.NoError(t, err)

		external := ngmodels.ExternalAlertmanagers
		err = store.UpdateAdminConfiguration(UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:        12,
				SendAlertsTo: &external,
			},
		})
		require.NoError(t, err)

		cfg, err := store.GetAdminConfiguration(12)
		require.NoError(t, err)
		require.NotNil(t, cfg.ExternalAlertmanagerUID)
		require.Equal(t, uid, *cfg.ExternalAlertmanagerUID)
		require.NotNil(t, cfg.SendAlertsTo)
		require.Equal(t, ngmodels.ExternalAlertmanagers, *cfg.SendAlertsTo)
	})

	t.Run("insert without SendAlertsTo does not mutate the command", func(t *testing.T) {
		cmd := UpdateAdminConfigurationCmd{
			AdminConfiguration: &ngmodels.AdminConfiguration{
				OrgID:                   13,
				ExternalAlertmanagerUID: &uid,
			},
		}
		require.NoError(t, store.UpdateAdminConfiguration(cmd))
		require.Nil(t, cmd.AdminConfiguration.SendAlertsTo)
	})
}
