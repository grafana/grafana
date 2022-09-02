package store

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type InstanceStore interface {
	GetAlertInstance(ctx context.Context, cmd *models.GetAlertInstanceQuery) error
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error
	SaveAlertInstances(ctx context.Context, cmd ...models.AlertInstance) error
	FetchOrgIds(ctx context.Context) ([]int64, error)
	DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error
	DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error
}

// GetAlertInstance is a handler for retrieving an alert instance based on OrgId, AlertDefintionID, and
// the hash of the labels.
func (st DBstore) GetAlertInstance(ctx context.Context, cmd *models.GetAlertInstanceQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		instance := models.AlertInstance{}
		s := strings.Builder{}
		s.WriteString(`SELECT * FROM alert_instance
			WHERE
				rule_org_id=? AND
				rule_uid=? AND
				labels_hash=?
		`)

		_, hash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		params := append(make([]interface{}, 0), cmd.RuleOrgID, cmd.RuleUID, hash)

		has, err := sess.SQL(s.String(), params...).Get(&instance)
		if !has {
			return fmt.Errorf("instance not found for labels %v (hash: %v), alert rule %v (org %v)", cmd.Labels, hash, cmd.RuleUID, cmd.RuleOrgID)
		}
		if err != nil {
			return err
		}

		cmd.Result = &instance
		return nil
	})
}

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st DBstore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*models.AlertInstance, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT * FROM alert_instance WHERE rule_org_id = ?", cmd.RuleOrgID)

		if cmd.RuleUID != "" {
			addToQuery(` AND rule_uid = ?`, cmd.RuleUID)
		}

		if cmd.State != "" {
			addToQuery(` AND current_state = ?`, cmd.State)
		}

		if cmd.StateReason != "" {
			addToQuery(` AND current_reason = ?`, cmd.StateReason)
		}

		if err := sess.SQL(s.String(), params...).Find(&alertInstances); err != nil {
			return err
		}

		cmd.Result = alertInstances
		return nil
	})
}

// SaveAlertInstances saves all the provided alert instances to the store in a single transaction.
func (st DBstore) SaveAlertInstances(ctx context.Context, cmd ...models.AlertInstance) error {
	// The function starts a single transaction and batches writes into
	// statements with `maxRows` instances per statements. This makes for a
	// fairly efficient transcation without creating statements that are too long
	// for some databases to process. For example, SQLite has a limit of 999
	// variables per write.

	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		keyNames := []string{"rule_org_id", "rule_uid", "labels_hash"}
		fieldNames := []string{
			"rule_org_id", "rule_uid", "labels", "labels_hash", "current_state",
			"current_reason", "current_state_since", "current_state_end", "last_eval_time",
		}
		fieldsPerRow := len(fieldNames)
		maxRows := 20
		maxArgs := maxRows * fieldsPerRow

		// Prepare a statement for the maximum batch size.
		bigUpsertSQL, err := st.SQLStore.Dialect.UpsertMultipleSQL(
			"alert_instance", keyNames, fieldNames, maxRows)
		if err != nil {
			return err
		}

		bigStmt, err := sess.DB().Prepare(bigUpsertSQL)
		if err != nil {
			return err
		}

		// Generate batches of `maxRows` and write the statements when full.
		args := make([]interface{}, 0, maxArgs)
		for _, alertInstance := range cmd {
			if len(args) >= maxArgs {
				if _, err = bigStmt.ExecContext(ctx, args...); err != nil {
					return err
				}
				args = args[:0]
			}

			labelTupleJSON, err := alertInstance.Labels.StringKey()
			if err != nil {
				return err
			}

			if err := models.ValidateAlertInstance(alertInstance); err != nil {
				return err
			}

			args = append(args,
				alertInstance.RuleOrgID, alertInstance.RuleUID, labelTupleJSON, alertInstance.LabelsHash,
				alertInstance.CurrentState, alertInstance.CurrentReason, alertInstance.CurrentStateSince.Unix(),
				alertInstance.CurrentStateEnd.Unix(), alertInstance.LastEvalTime.Unix())
		}

		// Write the final batch of up to maxRows in size.
		if len(args) > 0 && len(args)%fieldsPerRow == 0 {
			upsertSQL, err := st.SQLStore.Dialect.UpsertMultipleSQL(
				"alert_instance", keyNames, fieldNames, len(args)/fieldsPerRow)
			if err != nil {
				return err
			}

			stmt, err := sess.DB().Prepare(upsertSQL)
			if err != nil {
				return err
			}

			_, err = stmt.ExecContext(ctx, args...)
			if err != nil {
				return err
			}
		} else {
			return fmt.Errorf("failed to upsert alert instances. Last statements had %v fields, which is not a multiple of the number of fields, %v", len(args), fieldsPerRow)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func (st DBstore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	orgIds := []int64{}

	err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
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
		labelHashes []interface{}
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
		0, "", make([]interface{}, 0, maxRows),
	}
	placeholdersBuilder := strings.Builder{}
	placeholdersBuilder.WriteString("(")

	execQuery := func(s *sqlstore.DBSession, rd data, placeholders string) error {
		if len(rd.labelHashes) == 0 {
			return nil
		}

		placeholders = strings.TrimRight(placeholders, ", ")
		placeholders = placeholders + ")"

		queryString := fmt.Sprintf(
			"DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ? AND labels_hash IN %s;",
			placeholders,
		)

		execArgs := make([]interface{}, 0, 3+len(rd.labelHashes))
		execArgs = append(execArgs, queryString, rd.ruleOrgID, rd.ruleUID)
		execArgs = append(execArgs, rd.labelHashes...)
		_, err := s.Exec(execArgs...)
		if err != nil {
			return err
		}

		return nil
	}

	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
		return err
	})
}
