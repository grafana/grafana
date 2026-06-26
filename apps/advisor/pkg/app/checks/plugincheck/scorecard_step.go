package plugincheck

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginscoring"
)

const (
	ScorecardStepID      = "scorecard"
	scorecardKVNamespace = "plugin-scorecard"
	scorecardMinScore    = 45.0
)

type scorecardStep struct {
	kvStore *kvstore.NamespacedKVStore
}

func (s *scorecardStep) ID() string {
	return ScorecardStepID
}

func (s *scorecardStep) Title() string {
	return "Plugin security scorecard"
}

func (s *scorecardStep) Description() string {
	return "Checks installed plugins against the OpenSSF Scorecard to surface " +
		"security hygiene issues such as missing branch protection, unsigned releases, " +
		"and known vulnerabilities."
}

func (s *scorecardStep) Resolution() string {
	return "Review the plugin's Scorecard tab for specific findings. Consider whether the " +
		"plugin's security posture is acceptable for your environment, or switch to a " +
		"better-maintained alternative."
}

func (s *scorecardStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	pi, ok := it.(*pluginItem)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}

	p := pi.Plugin
	if p == nil {
		return nil, nil
	}
	if p.IsCorePlugin() {
		return nil, nil
	}

	if s.kvStore == nil {
		return nil, nil
	}

	cacheKey := p.ID + "@" + p.Info.Version
	raw, ok, err := s.kvStore.Get(ctx, cacheKey)
	if err != nil || !ok {
		return nil, nil
	}

	var result pluginscoring.ScorecardResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, nil
	}

	insights := pluginscoring.FromScorecard(p.ID, p.Info.Version, &result)
	score := overallInsightScore(insights)
	if score < 0 {
		return nil, nil
	}

	if score >= scorecardMinScore {
		return nil, nil
	}

	links := []advisor.CheckErrorLink{
		{
			Message: "View Scorecard",
			Url:     fmt.Sprintf("/plugins/%s?page=scorecard", p.ID),
		},
	}

	var severity advisor.CheckReportFailureSeverity
	var level string

	switch {
	case score < 25:
		severity = advisor.CheckReportFailureSeverityHigh
		level = "Critical"
	case score < 45:
		severity = advisor.CheckReportFailureSeverityLow
		level = "Poor"
	default:
		return nil, nil
	}

	itemName := fmt.Sprintf("%s score %d/100 is %s", p.Name, int(score), level)
	return []advisor.CheckReportFailure{checks.NewCheckReportFailureWithMoreInfo(
		severity,
		s.ID(),
		itemName,
		p.ID,
		links,
		"",
	)}, nil
}

func overallInsightScore(insights pluginscoring.CatalogPluginInsights) float64 {
	if len(insights.Insights) == 0 {
		return -1
	}
	total := 0.0
	count := 0
	for _, dim := range insights.Insights {
		if dim.ScoreValue > 0 {
			total += dim.ScoreValue
			count++
		}
	}
	if count == 0 {
		return -1
	}
	return total / float64(count)
}

func newScorecardStep(kvStore kvstore.KVStore) *scorecardStep {
	return &scorecardStep{
		kvStore: kvstore.WithNamespace(kvStore, 0, scorecardKVNamespace),
	}
}
