package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type provenanceRecord struct {
	Id         int   `xorm:"pk autoincr 'id'"`
	OrgID      int64 `xorm:"'org_id'"`
	RecordKey  string
	RecordType string
	Provenance models.Provenance
}

func (pr provenanceRecord) TableName() string {
	return "provenance_type"
}

// GetProvenance gets the provenance status for a provisionable object.
func (st DBstore) GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
	return models.ProvenanceNone, nil
}

// GetProvenance gets the provenance status for a provisionable object.
func (st DBstore) GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error) {
	resultMap := make(map[string]models.Provenance)
	return resultMap, nil
}

// SetProvenance changes the provenance status for a provisionable object.
func (st DBstore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	recordType := o.ResourceType()
	recordKey := o.ResourceID()

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// TODO: Add a unit-of-work pattern, so updating objects + provenance will happen consistently with rollbacks across stores.
		// TODO: Need to make sure that writing a record where our concurrency key fails will also fail the whole transaction. That way, this gets rolled back too. can't just check that 0 updates happened inmemory. Check with jp. If not possible, we need our own concurrency key.
		// TODO: Clean up stale provenance records periodically.

		if st.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingProvenanceLockWrites) {
			return st.setProvenanceWithLocking(sess, recordKey, recordType, org, p)
		}
		return st.setProvenanceUpsert(sess, recordKey, recordType, org, p)
	})
}

func (st DBstore) setProvenanceUpsert(sess *db.Session, recordKey, recordType string, org int64, p models.Provenance) error {
	upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
		provenanceRecord{}.TableName(),
		[]string{"record_key", "record_type", "org_id"},
		[]string{"record_key", "record_type", "org_id", "provenance"})

	params := []interface{}{
		recordKey,
		recordType,
		org,
		p,
	}

	_, err := sess.SQL(upsertSQL, params...).Query()
	if err != nil {
		return fmt.Errorf("failed to store provisioning status: %w", err)
	}
	return nil
}

func (st DBstore) setProvenanceWithLocking(sess *db.Session, recordKey, recordType string, org int64, p models.Provenance) error {
	// Check if the record exists with FOR UPDATE lock.
	// If it does, we just update, otherwise we upsert the record.
	// This is done to avoid deadlocks that can occur in MySQL when multiple transactions try to
	// insert records (even different) because of the gap and insert intention locks.
	exists, err := sess.Table(provenanceRecord{}).
		Where("record_key = ? AND record_type = ? AND org_id = ?", recordKey, recordType, org).
		ForUpdate().
		Exist()
	if err != nil {
		return fmt.Errorf("failed to check if provenance record exists: %w", err)
	}

	if exists {
		_, err = sess.Table(provenanceRecord{}).
			Where("record_key = ? AND record_type = ? AND org_id = ?", recordKey, recordType, org).
			Update(map[string]interface{}{
				"provenance": p,
			})
		if err != nil {
			return fmt.Errorf("failed to store provisioning status: %w", err)
		}
		return nil
	}

	// Still upsert in case it was created while we were checking
	return st.setProvenanceUpsert(sess, recordKey, recordType, org, p)
}

// DeleteProvenance deletes the provenance record from the table
func (st DBstore) DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(provenanceRecord{
			RecordKey:  o.ResourceID(),
			RecordType: o.ResourceType(),
			OrgID:      org,
		})
		return err
	})
}
