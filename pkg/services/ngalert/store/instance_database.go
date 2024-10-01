package store

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st DBstore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) (result []*models.AlertInstance, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertInstances := make([]*models.AlertInstance, 0)

		s := strings.Builder{}
		params := make([]any, 0)

		addToQuery := func(stmt string, p ...any) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT * FROM alert_instance WHERE rule_org_id = ?", cmd.RuleOrgID)

		if cmd.RuleUID != "" {
			addToQuery(` AND rule_uid = ?`, cmd.RuleUID)
		}
		if st.FeatureToggles.IsEnabled(ctx, featuremgmt.FlagAlertingNoNormalState) {
			s.WriteString(fmt.Sprintf(" AND NOT (current_state = '%s' AND current_reason = '')", models.InstanceStateNormal))
		}
		if err := sess.SQL(s.String(), params...).Find(&alertInstances); err != nil {
			return err
		}

		result = alertInstances
		return nil
	})
	return result, err
}

// SaveAlertInstance is a handler for saving a new alert instance.
func (st DBstore) SaveAlertInstance(ctx context.Context, alertInstance models.AlertInstance) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		if err := models.ValidateAlertInstance(alertInstance); err != nil {
			return err
		}

		labelTupleJSON, err := alertInstance.Labels.StringKey()
		if err != nil {
			return err
		}
		params := append(make([]any, 0),
			alertInstance.RuleOrgID,
			alertInstance.RuleUID,
			labelTupleJSON,
			alertInstance.LabelsHash,
			alertInstance.CurrentState,
			alertInstance.CurrentReason,
			alertInstance.CurrentStateSince.Unix(),
			alertInstance.CurrentStateEnd.Unix(),
			alertInstance.LastEvalTime.Unix(),
			nullableTimeToUnix(alertInstance.ResolvedAt),
			nullableTimeToUnix(alertInstance.LastSentAt),
			alertInstance.ResultFingerprint,
		)

		upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
			"alert_instance",
			[]string{"rule_org_id", "rule_uid", "labels_hash"},
			[]string{"rule_org_id", "rule_uid", "labels", "labels_hash", "current_state", "current_reason", "current_state_since", "current_state_end", "last_eval_time", "resolved_at", "last_sent_at", "result_fingerprint"})
		_, err = sess.SQL(upsertSQL, params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}

func (st DBstore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	orgIds := []int64{}

	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		s := strings.Builder{}
		params := make([]any, 0)

		addToQuery := func(stmt string, p ...any) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT DISTINCT rule_org_id FROM alert_instance")

		if err := sess.SQL(s.String(), params...).Find(&orgIds); err != nil {
			return err
		}
		return nil
	})

	return orgIds, err
}

// DeleteAlertInstances deletes instances with the provided keys in a single transaction.
func (st DBstore) DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error {
	if len(keys) == 0 {
		return nil
	}

	type data struct {
		ruleOrgID   int64
		ruleUID     string
		labelHashes []any
	}

	// Sort by org and rule UID. Most callers will have grouped already, but it's
	// cheap to verify and leads to more compact transactions.
	sort.Slice(keys, func(i, j int) bool {
		aye := keys[i]
		jay := keys[j]

		if aye.RuleOrgID < jay.RuleOrgID {
			return true
		}

		if aye.RuleOrgID == jay.RuleOrgID && aye.RuleUID < jay.RuleUID {
			return true
		}
		return false
	})

	maxRows := 200
	rowData := data{
		0, "", make([]any, 0, maxRows),
	}
	placeholdersBuilder := strings.Builder{}
	placeholdersBuilder.WriteString("(")

	execQuery := func(s *db.Session, rd data, placeholders string) error {
		if len(rd.labelHashes) == 0 {
			return nil
		}

		placeholders = strings.TrimRight(placeholders, ", ")
		placeholders = placeholders + ")"

		queryString := fmt.Sprintf(
			"DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ? AND labels_hash IN %s;",
			placeholders,
		)

		execArgs := make([]any, 0, 3+len(rd.labelHashes))
		execArgs = append(execArgs, queryString, rd.ruleOrgID, rd.ruleUID)
		execArgs = append(execArgs, rd.labelHashes...)
		_, err := s.Exec(execArgs...)
		if err != nil {
			return err
		}

		return nil
	}

	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		counter := 0

		// Create batches of up to 200 items and execute a new delete statement for each batch.
		for _, k := range keys {
			counter++
			// When a rule ID changes or we hit 200 hashes, issue a statement.
			if rowData.ruleOrgID != k.RuleOrgID || rowData.ruleUID != k.RuleUID || len(rowData.labelHashes) >= 200 {
				err := execQuery(sess, rowData, placeholdersBuilder.String())
				if err != nil {
					return err
				}

				// reset our reused data.
				rowData.ruleOrgID = k.RuleOrgID
				rowData.ruleUID = k.RuleUID
				rowData.labelHashes = rowData.labelHashes[:0]
				placeholdersBuilder.Reset()
				placeholdersBuilder.WriteString("(")
			}

			// Accumulate new values.
			rowData.labelHashes = append(rowData.labelHashes, k.LabelsHash)
			placeholdersBuilder.WriteString("?, ")
		}

		// Delete any remaining rows.
		if len(rowData.labelHashes) != 0 {
			err := execQuery(sess, rowData, placeholdersBuilder.String())
			if err != nil {
				return err
			}
		}

		return nil
	})

	return err
}

func (st DBstore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
		return err
	})
}

func (st DBstore) FullSync(ctx context.Context, instances []models.AlertInstance) error {
	if len(instances) == 0 {
		return nil
	}
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// First we delete all records from the table
		if _, err := sess.Exec("DELETE FROM alert_instance"); err != nil {
			return fmt.Errorf("failed to delete alert_instance table: %w", err)
		}
		for _, alertInstance := range instances {
			if err := models.ValidateAlertInstance(alertInstance); err != nil {
				st.Logger.Warn("Failed to validate alert instance, skipping", "err", err, "rule_uid", alertInstance.RuleUID)
				continue
			}
			labelTupleJSON, err := alertInstance.Labels.StringKey()
			if err != nil {
				st.Logger.Warn("Failed to generate alert instance labels key, skipping", "err", err, "rule_uid", alertInstance.RuleUID)
				continue
			}

			_, err = sess.Exec(
				"INSERT INTO alert_instance (rule_org_id, rule_uid, labels, labels_hash, current_state, current_reason, current_state_since, current_state_end, last_eval_time, resolved_at, last_sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
				alertInstance.RuleOrgID,
				alertInstance.RuleUID,
				labelTupleJSON,
				alertInstance.LabelsHash,
				alertInstance.CurrentState,
				alertInstance.CurrentReason,
				alertInstance.CurrentStateSince.Unix(),
				alertInstance.CurrentStateEnd.Unix(),
				alertInstance.LastEvalTime.Unix(),
				nullableTimeToUnix(alertInstance.ResolvedAt),
				nullableTimeToUnix(alertInstance.LastSentAt),
			)
			if err != nil {
				return fmt.Errorf("failed to insert into alert_instance table: %w", err)
			}
		}
		if err := sess.Commit(); err != nil {
			return fmt.Errorf("failed to commit alert_instance table: %w", err)
		}
		return nil
	})
}

// nullableTimeToUnix converts a nullable time.Time to nil, if it is nil, otherwise it converts the time.Time to a unix timestamp.
func nullableTimeToUnix(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	unix := t.Unix()
	return &unix
}
