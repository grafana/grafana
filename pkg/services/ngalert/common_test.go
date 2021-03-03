package ngalert

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func setupTestEnv(t *testing.T, baseIntervalSeconds int64) (AlertNG, *storeImpl) {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"ngalert": true}

	ng := overrideAlertNGInRegistry(t, cfg)
	ng.SQLStore = sqlstore.InitTestDB(t)

	err := ng.Init()
	require.NoError(t, err)
	return ng, &storeImpl{SQLStore: ng.SQLStore, baseInterval: time.Duration(baseIntervalSeconds) * time.Second}
}

func overrideAlertNGInRegistry(t *testing.T, cfg *setting.Cfg) AlertNG {
	ng := AlertNG{
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		log:           log.New("ngalert-test"),
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*AlertNG); ok {
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

func createTestAlertDefinition(t *testing.T, store *storeImpl, intervalSeconds int64) *AlertDefinition {
	cmd := saveAlertDefinitionCommand{
		OrgID:     1,
		Title:     fmt.Sprintf("an alert definition %d", rand.Intn(1000)),
		Condition: "A",
		Data: []eval.AlertQuery{
			{
				Model: json.RawMessage(`{
						"datasource": "__expr__",
						"type":"math",
						"expression":"2 + 2 > 1"
					}`),
				RelativeTimeRange: eval.RelativeTimeRange{
					From: eval.Duration(5 * time.Hour),
					To:   eval.Duration(3 * time.Hour),
				},
				RefID: "A",
			},
		},
		IntervalSeconds: &intervalSeconds,
	}
	err := store.saveAlertDefinition(&cmd)
	require.NoError(t, err)
	t.Logf("alert definition: %v with interval: %d created", cmd.Result.getKey(), intervalSeconds)
	return cmd.Result
}
