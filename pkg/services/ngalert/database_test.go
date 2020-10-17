package ngalert

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestDeleteAlertDefinitionByID(t *testing.T) {
	t.Run("When trying to delete an existing alert definition", func(t *testing.T) {
	})

	t.Run("When trying to delete an unknown alert definition", func(t *testing.T) {
	})
}

func TestGetAlertDefinitionByID(t *testing.T) {
	t.Run("When querying for an existing alert definition", func(t *testing.T) {
	})

	t.Run("When querying for an unknown alert definition", func(t *testing.T) {
	})
}

func TestSaveAlertDefinition(t *testing.T) {
	ng := setupTestEnvironment(t)

	t.Run("When trying to save an alert definition and cmd is valid", func(t *testing.T) {
	})

	t.Run("When trying to save an alert definition and missing data", func(t *testing.T) {
		cmd := SaveAlertDefinitionCommand{
			Name:      "alert definition 1",
			OrgID:     1,
			Condition: Condition{RefID: "A"},
		}

		err := ng.SaveAlertDefinition(&cmd)
		require.Error(t, err)
	})
}

func TestUpdateAlertDefinition(t *testing.T) {
	t.Run("When trying to update an existing alert definition", func(t *testing.T) {
	})

	t.Run("When trying to update an unknown alert definition", func(t *testing.T) {
	})
}

func setupTestEnvironment(t *testing.T) *AlertNG {
	t.Helper()

	store := sqlstore.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"ngalert": true}
	bus := store.Bus

	ng := &AlertNG{
		Bus:           bus,
		SQLStore:      store,
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
	}
	err := ng.Init()
	require.NoError(t, err)
	return ng
}
