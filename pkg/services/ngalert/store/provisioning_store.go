package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
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
	recordType := o.ResourceType()
	recordKey := o.ResourceID()

	provenance := models.ProvenanceNone
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		filter := "record_key = ? AND record_type = ? AND org_id = ?"
		var result models.Provenance
		has, err := sess.Table(provenanceRecord{}).Where(filter, recordKey, recordType, org).Desc("id").Cols("provenance").Get(&result)
		if err != nil {
			return fmt.Errorf("failed to query for existing provenance status: %w", err)
		}
		if has {
			provenance = result
		}
		return nil
	})
	if err != nil {
		return models.ProvenanceNone, err
	}
	return provenance, nil
}

// GetProvenance gets the provenance status for a provisionable object.
func (st DBstore) GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error) {
	resultMap := make(map[string]models.Provenance)
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		filter := "record_type = ? AND org_id = ?"
		rawData, err := sess.Table(provenanceRecord{}).Where(filter, resourceType, org).Desc("id").Cols("record_key", "provenance").QueryString()
		if err != nil {
			return fmt.Errorf("failed to query for existing provenance status: %w", err)
		}
		for _, data := range rawData {
			resultMap[data["record_key"]] = models.Provenance(data["provenance"])
		}
		return nil
	})
	return resultMap, err
}

// SetProvenance changes the provenance status for a provisionable object.
func (st DBstore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	recordType := o.ResourceType()
	recordKey := o.ResourceID()

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// TODO: Add a unit-of-work pattern, so updating objects + provenance will happen consistently with rollbacks across stores.
		// TODO: Need to make sure that writing a record where our concurrency key fails will also fail the whole transaction. That way, this gets rolled back too. can't just check that 0 updates happened inmemory. Check with jp. If not possible, we need our own concurrency key.
		// TODO: Clean up stale provenance records periodically.
		filter := "record_key = ? AND record_type = ? AND org_id = ?"
		_, err := sess.Table(provenanceRecord{}).Where(filter, recordKey, recordType, org).Delete(provenanceRecord{})

		if err != nil {
			return fmt.Errorf("failed to delete pre-existing provisioning status: %w", err)
		}

		record := provenanceRecord{
			RecordKey:  recordKey,
			RecordType: recordType,
			Provenance: p,
			OrgID:      org,
		}

		if _, err := sess.Insert(record); err != nil {
			return fmt.Errorf("failed to store provisioning status: %w", err)
		}

		return nil
	})
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
