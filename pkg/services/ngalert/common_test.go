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

func setupTestEnv(t *testing.T) *AlertNG {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"ngalert": true}

	ng := overrideAlertNGInRegistry(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	ng.SQLStore = sqlStore

	err := ng.Init()
	require.NoError(t, err)
	return &ng
}

func overrideAlertNGInRegistry(cfg *setting.Cfg) AlertNG {
	ng := AlertNG{
		SQLStore:      nil,
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		log:           log.New("ngalert-test"),
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*AlertNG); ok {
			return &registry.Descriptor{
				Name:         "AlertNG",
				Instance:     &ng,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return ng
}

func createTestAlertDefinition(t *testing.T, ng *AlertNG, intervalSeconds int64) *AlertDefinition {
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
	err := ng.saveAlertDefinition(&cmd)
	require.NoError(t, err)
	t.Logf("alert definition: %v with interval: %d created", cmd.Result.getKey(), intervalSeconds)
	return cmd.Result
}
