package store

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// jitteredBatch represents a batch of alert instances with associated jitter delay
type jitteredBatch struct {
	index     int
	instances []models.AlertInstance
	delay     time.Duration
}

// createJitteredBatches splits instances into batches and calculates jitter delays
func createJitteredBatches(instances []models.AlertInstance, batchSize int, jitterFunc func(int) time.Duration, logger log.Logger) []jitteredBatch {
	if len(instances) == 0 {
		return nil
	}

	var batches []jitteredBatch
	totalInstances := len(instances)

	for start := 0; start < totalInstances; start += batchSize {
		end := start + batchSize
		if end > totalInstances {
			end = totalInstances
		}

		batchIndex := start / batchSize
		batch := instances[start:end]
		delay := jitterFunc(batchIndex)

		batches = append(batches, jitteredBatch{
			index:     batchIndex,
			instances: batch,
			delay:     delay,
		})
	}

	return batches
}

type InstanceDBStore struct {
	SQLStore db.DB
	Logger   log.Logger
}

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st InstanceDBStore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) (result []*models.AlertInstance, err error) {
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
		if cmd.RuleGroup != "" {
			return errors.New("filtering by RuleGroup is not supported")
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
func (st InstanceDBStore) SaveAlertInstance(ctx context.Context, alertInstance models.AlertInstance) error {
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
			nullableTimeToUnix(alertInstance.FiredAt),
			nullableTimeToUnix(alertInstance.ResolvedAt),
			nullableTimeToUnix(alertInstance.LastSentAt),
			alertInstance.ResultFingerprint,
		)

		upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
			"alert_instance",
			[]string{"rule_org_id", "rule_uid", "labels_hash"},
			[]string{"rule_org_id", "rule_uid", "labels", "labels_hash", "current_state", "current_reason", "current_state_since", "current_state_end", "last_eval_time", "fired_at", "resolved_at", "last_sent_at", "result_fingerprint"})
		_, err = sess.SQL(upsertSQL, params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}

// DeleteAlertInstances deletes instances with the provided keys in a single transaction.
func (st InstanceDBStore) DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error {
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

// SaveAlertInstancesForRule is not implemented for instance database store.
func (st InstanceDBStore) SaveAlertInstancesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup, instances []models.AlertInstance) error {
	st.Logger.Error("SaveAlertInstancesForRule is not implemented for instance database store.")
	return errors.New("method SaveAlertInstancesForRule is not implemented for instance database store")
}

// DeleteAlertInstancesByRule deletes all instances for a given rule.
func (st InstanceDBStore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
		return err
	})
}

// FullSync performs a full synchronization of the given alert instances to the database.
//
// This method will delete all existing alert instances and insert the given instances in a single transaction.
//
// The batchSize parameter controls how many instances are inserted per batch. Increasing batchSize can improve
// performance for large datasets, but can also increase load on the database.
//
// If jitterFunc is provided, applies jitter delays between batches to distribute database load over time.
// If jitterFunc is nil, executes batches without delays for standard behavior.
func (st InstanceDBStore) FullSync(ctx context.Context, instances []models.AlertInstance, batchSize int, jitterFunc func(int) time.Duration) error {
	if len(instances) == 0 {
		return nil
	}

	if batchSize <= 0 {
		batchSize = 1
	}

	// If jitter is enabled, use the jittered approach
	if jitterFunc != nil {
		return st.fullSyncWithJitter(ctx, instances, batchSize, jitterFunc)
	}

	// Otherwise, use the standard approach without jitter
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// First we delete all records from the table
		if _, err := sess.Exec("DELETE FROM alert_instance"); err != nil {
			return fmt.Errorf("failed to delete alert_instance table: %w", err)
		}

		total := len(instances)
		for start := 0; start < total; start += batchSize {
			end := start + batchSize
			if end > total {
				end = total
			}

			batch := instances[start:end]

			if err := st.insertInstancesBatch(sess, batch); err != nil {
				return fmt.Errorf("failed to insert batch [%d:%d]: %w", start, end, err)
			}
		}

		return nil
	})
}

// fullSyncWithJitter performs a full synchronization with jitter delays between batches.
//
// This method maintains atomicity by performing all operations within a single transaction,
// while distributing the INSERT operations over time to reduce database load spikes.
//
// The instances parameter should be a flat list of all alert instances.
// The jitterFunc should return the delay duration for a given batch index.
func (st InstanceDBStore) fullSyncWithJitter(ctx context.Context, instances []models.AlertInstance, batchSize int, jitterFunc func(int) time.Duration) error {
	if len(instances) == 0 {
		return nil
	}

	if batchSize <= 0 {
		batchSize = 1
	}

	// Prepare all batches and sorting OUTSIDE the transaction
	batches := createJitteredBatches(instances, batchSize, jitterFunc, st.Logger)

	// Sort batches by delay time (ascending)
	sort.Slice(batches, func(i, j int) bool {
		return batches[i].delay < batches[j].delay
	})

	// Execute the optimized transaction with pre-calculated batches
	return st.executeJitteredBatchesInTransaction(ctx, batches)
}

// executeJitteredBatchesInTransaction executes pre-calculated batches within a single transaction
// with jitter delays. All preparation work should be done before calling this method.
func (st InstanceDBStore) executeJitteredBatchesInTransaction(ctx context.Context, batches []jitteredBatch) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Capture the actual transaction start time for accurate delay calculations
		transactionStartTime := time.Now()

		// First we delete all records from the table
		if _, err := sess.Exec("DELETE FROM alert_instance"); err != nil {
			return fmt.Errorf("failed to delete alert_instance table: %w", err)
		}

		// Execute batches in order with absolute time-based delays using transaction start time
		for _, batch := range batches {
			// Calculate target time and wait until then
			targetTime := transactionStartTime.Add(batch.delay)
			if sleepDuration := time.Until(targetTime); sleepDuration > 0 {
				time.Sleep(sleepDuration)
			}

			// Insert this batch
			if err := st.insertInstancesBatch(sess, batch.instances); err != nil {
				return fmt.Errorf("failed to insert batch %d [%d instances]: %w", batch.index, len(batch.instances), err)
			}
		}

		if err := sess.Commit(); err != nil {
			return fmt.Errorf("failed to commit alert_instance table: %w", err)
		}

		return nil
	})
}

func (st InstanceDBStore) insertInstancesBatch(sess *sqlstore.DBSession, batch []models.AlertInstance) error {
	// If the batch is empty, nothing to insert.
	if len(batch) == 0 {
		return nil
	}

	query := strings.Builder{}
	placeholders := make([]string, 0, len(batch))
	args := make([]any, 0, len(batch)*12)

	query.WriteString("INSERT INTO alert_instance ")
	query.WriteString("(rule_org_id, rule_uid, labels, labels_hash, current_state, current_reason, current_state_since, current_state_end, last_eval_time, fired_at, resolved_at, last_sent_at) VALUES ")

	for _, instance := range batch {
		if err := models.ValidateAlertInstance(instance); err != nil {
			st.Logger.Warn("Skipping invalid alert instance", "err", err, "rule_uid", instance.RuleUID)
			continue
		}

		labelTupleJSON, err := instance.Labels.StringKey()
		if err != nil {
			st.Logger.Warn("Skipping instance with invalid labels key", "err", err, "rule_uid", instance.RuleUID)
			continue
		}

		placeholders = append(placeholders, "(?,?,?,?,?,?,?,?,?,?,?,?)")
		args = append(args,
			instance.RuleOrgID,
			instance.RuleUID,
			labelTupleJSON,
			instance.LabelsHash,
			instance.CurrentState,
			instance.CurrentReason,
			instance.CurrentStateSince.Unix(),
			instance.CurrentStateEnd.Unix(),
			instance.LastEvalTime.Unix(),
			nullableTimeToUnix(instance.FiredAt),
			nullableTimeToUnix(instance.ResolvedAt),
			nullableTimeToUnix(instance.LastSentAt),
		)
	}

	// If no valid instances were found in this batch, skip insertion.
	if len(placeholders) == 0 {
		return nil
	}

	query.WriteString(strings.Join(placeholders, ","))

	execArgs := make([]any, 0, len(args)+1)
	execArgs = append(execArgs, query.String())
	execArgs = append(execArgs, args...)

	if _, err := sess.Exec(execArgs...); err != nil {
		return fmt.Errorf("failed to insert instances: %w", err)
	}

	return nil
}

// nullableTimeToUnix converts a nullable time.Time to nil, if it is nil, otherwise it converts the time.Time to a unix timestamp.
func nullableTimeToUnix(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	unix := t.Unix()
	return &unix
}
