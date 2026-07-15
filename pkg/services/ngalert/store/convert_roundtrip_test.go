package store

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

// TestConvertedRuleStoreRoundTripIsStable reproduces the external-ruler-sync
// version-churn investigation at the store layer: a re-apply (after a pod
// restart) diffs freshly-converted rules against what's stored. If the store's
// model->row->model round-trip changes any field calcDelta compares, every
// re-apply bumps the version even though nothing changed. This converts a rule,
// runs it through the exact compat (de)serialization the store uses, and diffs
// the result against a fresh conversion with calcDelta's ignore-list.
func TestConvertedRuleStoreRoundTripIsStable(t *testing.T) {
	c, err := prom.NewConverter(prom.Config{
		DatasourceUID:              "ds-uid",
		DatasourceType:             datasources.DS_PROMETHEUS,
		TargetDatasourceUID:        "ds-uid",
		TargetDatasourceType:       datasources.DS_PROMETHEUS,
		DefaultInterval:            time.Minute,
		KeepOriginalRuleDefinition: new(true),
		SourceIdentifier:           "ds-uid",
	})
	require.NoError(t, err)

	group := prom.PrometheusRuleGroup{
		Name:     "availability",
		Interval: prommodel.Duration(time.Minute),
		Rules: []prom.PrometheusRule{
			{
				Alert:       "InstanceDown",
				Expr:        "up == 0",
				For:         new(prommodel.Duration(5 * time.Minute)),
				Labels:      map[string]string{"severity": "critical", "team": "platform", "zone": "a"},
				Annotations: map[string]string{"summary": "down", "description": "d", "runbook": "r"},
			},
			{
				Record: "job:http_requests:rate5m",
				Expr:   "sum by (job) (rate(http_requests_total[5m]))",
				Labels: map[string]string{"aggregation": "rate", "team": "platform"},
			},
		},
	}

	g, err := c.PrometheusRulesToGrafana(1, "folder-uid", group)
	require.NoError(t, err)

	for i := range g.Rules {
		fresh := g.Rules[i]

		row, err := alertRuleFromModelsAlertRule(fresh) // model -> DB row
		require.NoError(t, err)
		back, err := alertRuleToModelsAlertRule(row, log.NewNopLogger()) // DB row -> model
		require.NoError(t, err)

		diff := back.Diff(&fresh, AlertRuleFieldsToIgnoreInDiff[:]...)
		require.Emptyf(t, diff, "store round-trip changed rule %q (this is what re-apply diffs against stored):\n%s", fresh.Title, diff.String())
	}
}
