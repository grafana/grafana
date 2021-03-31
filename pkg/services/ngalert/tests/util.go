package tests

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// setupTestEnv initializes a store to used by the tests.
func setupTestEnv(t *testing.T, baseIntervalSeconds int64) *store.DBstore {
	cfg := setting.NewCfg()
	// AlertNG is disabled by default and only if it's enabled
	// its database migrations run and the relative database tables are created
	cfg.FeatureToggles = map[string]bool{"ngalert": true}

	ng := overrideAlertNGInRegistry(t, cfg)
	ng.SQLStore = sqlstore.InitTestDB(t)

	err := ng.Init()
	require.NoError(t, err)
	return &store.DBstore{SQLStore: ng.SQLStore, BaseInterval: time.Duration(baseIntervalSeconds) * time.Second}
}

func overrideAlertNGInRegistry(t *testing.T, cfg *setting.Cfg) ngalert.AlertNG {
	ng := ngalert.AlertNG{
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		Log:           log.New("ngalert-test"),
	}

	// hook for initialising the service after the Cfg is populated
	// so that database migrations will run
	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*ngalert.AlertNG); ok {
			return &registry.Descriptor{
				Name:         descriptor.Name,
				Instance:     &ng,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return ng
}

// createTestAlertRule creates a dummy alert definition to be used by the tests.
func createTestAlertRule(t *testing.T, dbstore *store.DBstore, intervalSeconds int64) *models.AlertRule {
	cmd := store.UpsertRule{
		New: models.AlertRule{
			OrgID:     1,
			Title:     fmt.Sprintf("an alert definition %d", rand.Intn(1000)),
			Condition: "A",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
							"datasource": "__expr__",
							"type":"math",
							"expression":"2 + 2 > 1"
						}`),
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(5 * time.Hour),
						To:   models.Duration(3 * time.Hour),
					},
					RefID: "A",
				},
			},
			IntervalSeconds: intervalSeconds,
		},
	}
	err := dbstore.UpsertAlertRules([]store.UpsertRule{cmd})
	require.NoError(t, err)
	t.Logf("alert definition: %v with interval: %d created", cmd.Result.GetKey(), intervalSeconds)
	return cmd.Result
}

// createTestAlertDefinition creates a dummy alert definition to be used by the tests.
func createTestAlertDefinition(t *testing.T, store *store.DBstore, intervalSeconds int64) *models.AlertDefinition {
	cmd := models.SaveAlertDefinitionCommand{
		OrgID:     1,
		Title:     fmt.Sprintf("an alert definition %d", rand.Intn(1000)),
		Condition: "A",
		Data: []models.AlertQuery{
			{
				Model: json.RawMessage(`{
						"datasource": "__expr__",
						"type":"math",
						"expression":"2 + 2 > 1"
					}`),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(5 * time.Hour),
					To:   models.Duration(3 * time.Hour),
				},
				RefID: "A",
			},
		},
		IntervalSeconds: &intervalSeconds,
	}
	err := store.SaveAlertDefinition(&cmd)
	require.NoError(t, err)
	t.Logf("alert definition: %v with interval: %d created", cmd.Result.GetKey(), intervalSeconds)
	return cmd.Result
}
