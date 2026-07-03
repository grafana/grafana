package prom

import (
	"encoding/json"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ignoreInDiff mirrors store.AlertRuleFieldsToIgnoreInDiff — the fields calcDelta
// ignores when deciding whether a rule changed. Hardcoded to avoid a store import.
var ignoreInDiff = []string{"ID", "Version", "Updated", "UpdatedBy", "FolderFullpath"}

// TestPrometheusRulesToGrafana_ConversionIsDeterministic reproduces the
// version-churn investigation: the external ruler sync re-applies every time a
// pod (re)starts, and calcDelta bumps the rule version even though the k8s spec
// is unchanged. This checks whether the converter itself is the source — i.e.
// whether two conversions of identical input diff under calcDelta's comparison,
// including after a JSON round-trip (how the rule/metadata is persisted).
func TestPrometheusRulesToGrafana_ConversionIsDeterministic(t *testing.T) {
	cfg := Config{
		DatasourceUID:              "ds-uid",
		DatasourceType:             datasources.DS_PROMETHEUS,
		TargetDatasourceUID:        "ds-uid",
		TargetDatasourceType:       datasources.DS_PROMETHEUS,
		DefaultInterval:            time.Minute,
		KeepOriginalRuleDefinition: new(true),
		SourceIdentifier:           "ds-uid",
	}
	group := PrometheusRuleGroup{
		Name:     "availability",
		Interval: prommodel.Duration(time.Minute),
		Rules: []PrometheusRule{
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

	convert := func() *models.AlertRuleGroup {
		c, err := NewConverter(cfg)
		require.NoError(t, err)
		g, err := c.PrometheusRulesToGrafana(1, "folder-uid", group)
		require.NoError(t, err)
		return g
	}

	g1, g2 := convert(), convert()
	require.Equal(t, len(g1.Rules), len(g2.Rules))

	for i := range g1.Rules {
		r1, r2 := g1.Rules[i], g2.Rules[i]

		// (1) Two independent conversions of the same input, compared exactly as
		// calcDelta compares submitted-vs-stored rules.
		diff := r1.Diff(&r2, ignoreInDiff...)
		require.Emptyf(t, diff, "conversion #1 vs #2 differ for %q:\n%s", r1.Title, diff.String())

		// (2) Round-trip rule 1 through JSON (how the store persists it) and
		// re-compare to a fresh conversion — this is what the re-apply diffs
		// against the stored rule after a restart.
		b, err := json.Marshal(r1)
		require.NoError(t, err)
		var rt models.AlertRule
		require.NoError(t, json.Unmarshal(b, &rt))
		diffRT := rt.Diff(&r2, ignoreInDiff...)
		require.Emptyf(t, diffRT, "JSON round-trip vs fresh conversion differ for %q:\n%s", r1.Title, diffRT.String())
	}
}
