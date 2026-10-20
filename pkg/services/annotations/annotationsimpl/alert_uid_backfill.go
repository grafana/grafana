package annotationsimpl

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// Kept below SQLite's limit of 999 parameters per statement.
const alertUIDBackfillBatchSize = 500

// BackfillAlertUIDs sets alert_uid on alert annotations that only have an alert_id.
// Rows whose rule no longer exists are set to annotations.AlertUIDRuleNotFound, so every row it
// examines gets a non-empty alert_uid and is not examined again. It is safe to run repeatedly and
// concurrently: each run only picks up alert rows whose alert_uid is still empty, such as rows
// written by older versions of Grafana.
func BackfillAlertUIDs(ctx context.Context, sqlStore db.DB, ruleLister rules.RuleLister, orgIDs []int64, logger log.Logger) {
	for _, orgID := range orgIDs {
		if ctx.Err() != nil {
			return
		}
		updated, err := backfillOrgAlertUIDs(ctx, sqlStore, ruleLister, orgID)
		if err != nil {
			logger.Error("Failed to backfill alert UIDs on annotations", "orgID", orgID, "updated", updated, "error", err)
			continue
		}
		if updated > 0 {
			logger.Info("Backfilled alert UIDs on annotations", "orgID", orgID, "updated", updated)
		}
	}
}

type alertIDRow struct {
	ID      int64 `xorm:"id"`
	AlertID int64 `xorm:"alert_id"`
}

func backfillOrgAlertUIDs(ctx context.Context, sqlStore db.DB, ruleLister rules.RuleLister, orgID int64) (int64, error) {
	// No ORDER BY, so the query can use the (org_id, alert_uid, alert_id) index.
	query := "SELECT id, alert_id FROM annotation WHERE org_id = ? AND alert_uid = '' AND alert_id > 0 " +
		sqlStore.GetDialect().Limit(alertUIDBackfillBatchSize)

	// Only loaded once the org has rows to backfill.
	var ruleUIDs map[int64]string
	var total int64
	for {
		if err := ctx.Err(); err != nil {
			return total, err
		}

		var batch []alertIDRow
		if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query, orgID).Find(&batch)
		}); err != nil {
			return total, fmt.Errorf("failed to fetch annotations: %w", err)
		}
		if len(batch) == 0 {
			return total, nil
		}

		if ruleUIDs == nil {
			// A failure here must not mark rows as orphaned, so they stay empty until the next run.
			rulesInOrg, err := ruleLister.ListAlertRules(ctx, &ngmodels.ListAlertRulesQuery{OrgID: orgID})
			if err != nil {
				return total, fmt.Errorf("failed to list alert rules: %w", err)
			}
			ruleUIDs = make(map[int64]string, len(rulesInOrg))
			for _, rule := range rulesInOrg {
				ruleUIDs[rule.ID] = rule.UID
			}
		}

		idsByUID := make(map[string][]any)
		for _, row := range batch {
			uid, ok := ruleUIDs[row.AlertID]
			if !ok {
				uid = annotations.AlertUIDRuleNotFound
			}
			idsByUID[uid] = append(idsByUID[uid], row.ID)
		}

		for uid, ids := range idsByUID {
			sql := "UPDATE annotation SET alert_uid = ? WHERE alert_uid = '' AND id IN (?" + strings.Repeat(",?", len(ids)-1) + ")"
			var affected int64
			if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
				res, err := sess.Exec(append([]any{sql, uid}, ids...)...)
				if err != nil {
					return err
				}
				affected, err = res.RowsAffected()
				return err
			}); err != nil {
				return total, fmt.Errorf("failed to update annotations: %w", err)
			}
			total += affected
		}
	}
}
