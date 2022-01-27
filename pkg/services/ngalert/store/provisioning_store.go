package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type provenanceRecord struct {
	Id         int `xorm:"pk autoincr 'id'"`
	OrgId      int
	RecordKey  string
	RecordType string
	Provenance models.Provenance
}

func (pr provenanceRecord) TableName() string {
	return "provenance_type"
}

type ProvisioningStore interface {
	GetProvenance(o interface{}) (models.Provenance, error)
	SetProvenance(o interface{}, p models.Provenance) error
}

func (st DBstore) GetProvenance(o interface{}) (models.Provenance, error) {
	recordType := models.GetResourceTypeIdentifier(o)
	if recordType == "" {
		return models.None, nil
	}
	recordKey := models.GetResourceUniqueIdentifier(o)
	if recordKey == "" {
		return models.None, nil
	}

	provenance := models.None
	err := st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		result := make([]*provenanceRecord, 0)
		q := "SELECT * FROM provenance_type WHERE record_key = ? AND record_type = ? ORDER BY id ASC LIMIT 1"
		params := []interface{}{recordKey, recordType}

		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}
		if len(result) < 1 {
			return nil
		}

		provenance = result[0].Provenance
		return nil
	})
	if err != nil {
		return models.None, err
	}
	return provenance, nil
}

func (st DBstore) SetProvenance(o interface{}, p models.Provenance) error {
	recordType := models.GetResourceTypeIdentifier(o)
	if recordType == "" {
		return nil
	}
	recordKey := models.GetResourceUniqueIdentifier(o)
	if recordKey == "" {
		return nil
	}

	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// TODO: this is gonna slap the database. Is in-memory caching of provenance status possible? does this break HA?
		// TODO: either way, this is a really naive way of doing this.
		// TODO: this also totally won't slap the database if we use a unit of work pattern. This solves other problems too.
		// TODO: Need to make sure that writing a record where our concurrency key fails will also fail the whole transaction. That way, this gets rolled back too. can't just check that 0 updates happened inmemory. Check with jp. If not possible, we need our own concurrency key.
		q := "DELETE FROM provenance_type WHERE record_key = ? AND record_type = ?"
		_, err := sess.Exec(q, recordKey, recordType)
		if err != nil {
			return fmt.Errorf("failed to delete pre-existing provisioning status: %w", err)
		}

		record := provenanceRecord{
			RecordKey:  recordKey,
			RecordType: recordType,
			Provenance: p,
		}

		if _, err := sess.Insert(record); err != nil {
			return fmt.Errorf("failed to store provisioning status: %w", err)
		}

		return nil
	})
}
