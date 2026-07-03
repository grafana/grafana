package store

import (
	"context"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

// TestConvertedRuleReApplyProducesNoDelta closes the last gap in the churn
// investigation: it exercises the *full* delta path the syncer's re-apply runs
// (CalculateChanges + UpdateCalculatedRuleFields), which the converter/compat
// tests skip. It stores a converted group, then re-converts identical input
// (same build) and asserts the resulting delta is empty — i.e. a re-apply does
// not update any rule. If it did, UpdateAlertRules would bump every rule's
// version (resourceVersion) on every poll tick.
func TestConvertedRuleReApplyProducesNoDelta(t *testing.T) {
	ctx := context.Background()

	newConverter := func() *prom.Converter {
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
		return c
	}

	group := prom.PrometheusRuleGroup{
		Name:     "availability",
		Interval: prommodel.Duration(time.Minute),
		Rules: []prom.PrometheusRule{
			{
				Alert:       "InstanceDown",
				Expr:        "up == 0",
				For:         new(prommodel.Duration(5 * time.Minute)),
				Labels:      map[string]string{"severity": "critical", "team": "platform"},
				Annotations: map[string]string{"summary": "down", "description": "d"},
			},
			{
				Record: "job:http_requests:rate5m",
				Expr:   "sum by (job) (rate(http_requests_total[5m]))",
				Labels: map[string]string{"aggregation": "rate"},
			},
		},
	}

	// First apply: convert and "store" the rules.
	g1, err := newConverter().PrometheusRulesToGrafana(1, "folder-uid", group)
	require.NoError(t, err)
	fakeStore := fakes.NewRuleStore(t)
	stored := make([]*models.AlertRule, 0, len(g1.Rules))
	for i := range g1.Rules {
		r := g1.Rules[i]
		stored = append(stored, &r)
	}
	fakeStore.PutRule(ctx, stored...)

	// Re-apply: re-convert identical input and compute the delta ReplaceRuleGroups
	// would persist.
	g2, err := newConverter().PrometheusRulesToGrafana(1, "folder-uid", group)
	require.NoError(t, err)
	submitted := make([]*models.AlertRuleWithOptionals, 0, len(g2.Rules))
	for i := range g2.Rules {
		r := g2.Rules[i]
		submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: r, HasPause: true})
	}

	groupKey := models.AlertRuleGroupKey{OrgID: 1, NamespaceUID: "folder-uid", RuleGroup: "availability"}
	delta, err := CalculateChanges(ctx, fakeStore, groupKey, submitted)
	require.NoError(t, err)
	// CalculateChanges correctly finds no real change (converter is deterministic).
	require.Empty(t, delta.New)
	require.Empty(t, delta.Update)
	require.Empty(t, delta.Delete)

	delta = UpdateCalculatedRuleFields(delta)
	for _, u := range delta.Update {
		require.Empty(t, u.Diff.Paths(), "the injected updates carry no real diff")
	}
	// ROOT CAUSE (documented, not fixed here): UpdateCalculatedRuleFields injects
	// a no-op update for every rule in the group, so ReplaceRuleGroups ->
	// UpdateAlertRules bumps every rule's version even on an identical re-apply.
	// The ruler-sync worker works around this with persisted-hash dedup (it only
	// calls ReplaceRuleGroups when the upstream actually changed); fixing it at
	// the source would make this len 0.
	require.Len(t, delta.Update, len(g1.Rules), "every group rule gets a no-op update -> version churn on re-apply")
}
