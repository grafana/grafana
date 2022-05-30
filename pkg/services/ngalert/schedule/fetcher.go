package schedule

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (sch *schedule) getAlertRules(ctx context.Context, disabledOrgs []int64) []*models.SchedulableAlertRule {
	start := time.Now()
	defer func() {
		sch.metrics.GetAlertRulesDuration.Observe(time.Since(start).Seconds())
	}()

	q := models.GetAlertRulesForSchedulingQuery{
		ExcludeOrgIDs: disabledOrgs,
	}

	err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q)
	if err != nil {
		sch.log.Error("failed to fetch alert definitions - using cache", "err", err, "cached_rules", len(sch.currentRuleSet))
		return sch.currentRuleSet
	}

	sch.CacheRuleSet(q.Result)
	return q.Result
}

// CacheRuleSet caches the current rule set in memory to avoid database failures halting alert evaluations.
func (sch *schedule) CacheRuleSet(result []*models.SchedulableAlertRule) {
	h := sha256.New()
	for i := range result {
		_, _ = h.Write([]byte(fmt.Sprintf("%v", result[i])))
	}

	sch.currentRuleSet = result
	sch.currentRuleSetHash = fmt.Sprintf("%x", h.Sum(nil))
}
