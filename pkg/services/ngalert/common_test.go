package ngalert

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func setupTestEnv(t *testing.T) *AlertNG {
	sqlStore := sqlstore.InitTestDB(t)
	cfg := setting.Cfg{}
	cfg.FeatureToggles = map[string]bool{"ngalert": true}
	ng := AlertNG{
		SQLStore: sqlStore,
		Cfg:      &cfg,
		log:      log.New("ngalert-test"),
	}
	return &ng
}

func createTestAlertDefinition(t *testing.T, ng *AlertNG, intervalInSeconds int64) *AlertDefinition {
	cmd := saveAlertDefinitionCommand{
		OrgID: 1,
		Name:  "an alert definition",
		Condition: condition{
			RefID: "A",
			QueriesAndExpressions: []eval.AlertQuery{
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
		},
		IntervalInSeconds: &intervalInSeconds,
	}
	err := ng.saveAlertDefinition(&cmd)
	require.NoError(t, err)
	t.Logf("alert definition: %d with interval: %d created", cmd.Result.ID, intervalInSeconds)
	return cmd.Result
}
