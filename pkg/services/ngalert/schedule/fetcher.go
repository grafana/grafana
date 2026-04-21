package schedule

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// updateSchedulableAlertRules updates the alert rules for the scheduler.
// It returns diff that contains rule keys that were updated since the last poll,
// and an error if the database query encountered problems.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context) (diff, error) {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds())
	}()

	ruleChains, err := sch.ruleChainStore.GetRuleChainForScheduling(ctx)
	if err != nil {
		return diff{}, fmt.Errorf("failed to get rule chains: %w", err)
	}
	chainsUpdated := sch.schedulableAlertRules.ruleChainsNeedUpdate(ruleChains)

	if !sch.schedulableAlertRules.isEmpty() {
		keys, err := sch.ruleStore.GetAlertRulesKeysForScheduling(ctx)
		if err != nil {
			return diff{}, err
		}
		rulesUpdated := sch.schedulableAlertRules.rulesNeedUpdate(keys)

		if !chainsUpdated && !rulesUpdated {
			sch.log.Debug("No changes detected. Skip updating")
			return diff{}, nil
		}
	}
	// At this point, we know we need to re-fetch rules as there are changes.
	q := models.GetAlertRulesForSchedulingQuery{
		PopulateFolders: !sch.disableGrafanaFolder,
	}
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		return diff{}, fmt.Errorf("failed to get alert rules: %w", err)
	}

	d := sch.schedulableAlertRules.set(q.ResultRules, q.ResultFoldersTitles, ruleChains)
	sch.log.Debug("Alert rules fetched", "rulesCount", len(q.ResultRules), "foldersCount", len(q.ResultFoldersTitles), "updatedRules", len(d.updated))
	return d, nil
}
