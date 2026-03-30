package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type provenanceRecord struct {
	Id              int   `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"'org_id'"`
	RecordKey       string
	RecordType      string
	Provenance      models.Provenance
	ManagerKind     string `xorm:"manager_kind"`
	ManagerIdentity string `xorm:"manager_identity"`
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

// GetProvenancesByUIDs gets the provenance status for specific UIDs.
func (st DBstore) GetProvenancesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]models.Provenance, error) {
	if len(uids) == 0 {
		return map[string]models.Provenance{}, nil
	}

	result := make(map[string]models.Provenance, len(uids))
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		rawData, err := sess.Table(provenanceRecord{}).
			Where("record_type = ? AND org_id = ?", resourceType, org).
			In("record_key", uids).
			Cols("record_key", "provenance").
			QueryString()
		if err != nil {
			return fmt.Errorf("failed to query for existing provenance status: %w", err)
		}
		for _, data := range rawData {
			result[data["record_key"]] = models.Provenance(data["provenance"])
		}
		return nil
	})
	return result, err
}

// SetProvenance changes the provenance status for a provisionable object.
func (st DBstore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	recordType := o.ResourceType()
	recordKey := o.ResourceID()

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// TODO: Add a unit-of-work pattern, so updating objects + provenance will happen consistently with rollbacks across stores.
		// TODO: Need to make sure that writing a record where our concurrency key fails will also fail the whole transaction. That way, this gets rolled back too. can't just check that 0 updates happened inmemory. Check with jp. If not possible, we need our own concurrency key.
		// TODO: Clean up stale provenance records periodically.

		//nolint:staticcheck // not yet migrated to OpenFeature
		if st.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingProvenanceLockWrites) {
			return st.setProvenanceWithLocking(sess, recordKey, recordType, org, p)
		}
		return st.setProvenanceUpsert(sess, recordKey, recordType, org, p)
	})
}

func (st DBstore) setProvenanceUpsert(sess *db.Session, recordKey, recordType string, org int64, p models.Provenance) error {
	// Always derive manager_kind from provenance so the two columns stay in sync.
	mp := models.ProvenanceToManagerProperties(p)

	upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
		provenanceRecord{}.TableName(),
		[]string{"record_key", "record_type", "org_id"},
		[]string{"record_key", "record_type", "org_id", "provenance", "manager_kind", "manager_identity"})

	params := []interface{}{
		recordKey,
		recordType,
		org,
		p,
		string(mp.Kind),
		mp.Identity,
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
		// Always derive manager_kind from provenance so the two columns stay in sync.
		mp := models.ProvenanceToManagerProperties(p)
		_, err = sess.Table(provenanceRecord{}).
			Where("record_key = ? AND record_type = ? AND org_id = ?", recordKey, recordType, org).
			Update(map[string]interface{}{
				"provenance":       p,
				"manager_kind":     string(mp.Kind),
				"manager_identity": mp.Identity,
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

// GetManagerProperties returns the ManagerProperties for a provisionable object.
// For rows written by legacy code (manager_kind is empty), it falls back to
// deriving ManagerProperties from the provenance column.
func (st DBstore) GetManagerProperties(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error) {
	recordType := o.ResourceType()
	recordKey := o.ResourceID()

	var record provenanceRecord
	found := false
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		filter := "record_key = ? AND record_type = ? AND org_id = ?"
		var err error
		found, err = sess.Table(provenanceRecord{}).Where(filter, recordKey, recordType, org).Desc("id").Get(&record)
		return err
	})
	if err != nil {
		return utils.ManagerProperties{}, fmt.Errorf("failed to query for manager properties: %w", err)
	}
	if !found {
		return utils.ManagerProperties{}, nil
	}
	if record.ManagerKind != "" {
		mp := utils.ManagerProperties{
			Kind:     utils.ParseManagerKindString(record.ManagerKind),
			Identity: record.ManagerIdentity,
		}
		// Consistency check: manager_kind and provenance columns should agree.
		expectedProv := models.ManagerPropertiesToProvenance(mp)
		if record.Provenance != "" && record.Provenance != expectedProv {
			st.Logger.Warn("manager_kind and provenance columns disagree; using manager_kind as authoritative",
				"record_key", record.RecordKey,
				"record_type", record.RecordType,
				"manager_kind", record.ManagerKind,
				"provenance", record.Provenance,
				"expected_provenance", expectedProv,
			)
		}
		return mp, nil
	}
	// Legacy row: derive from provenance column.
	return models.ProvenanceToManagerProperties(record.Provenance), nil
}

// GetManagerPropertiesByUIDs returns ManagerProperties for specific UIDs of a resource type.
func (st DBstore) GetManagerPropertiesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]utils.ManagerProperties, error) {
	if len(uids) == 0 {
		return map[string]utils.ManagerProperties{}, nil
	}

	result := make(map[string]utils.ManagerProperties, len(uids))
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var records []provenanceRecord
		err := sess.Table(provenanceRecord{}).
			Where("record_type = ? AND org_id = ?", resourceType, org).
			In("record_key", uids).
			Find(&records)
		if err != nil {
			return fmt.Errorf("failed to query for manager properties: %w", err)
		}
		for _, r := range records {
			if r.ManagerKind != "" {
				result[r.RecordKey] = utils.ManagerProperties{
					Kind:     utils.ParseManagerKindString(r.ManagerKind),
					Identity: r.ManagerIdentity,
				}
			} else {
				result[r.RecordKey] = models.ProvenanceToManagerProperties(r.Provenance)
			}
		}
		return nil
	})
	return result, err
}

// SetManagerProperties stores ManagerProperties for a provisionable object.
// It also derives and stores the legacy provenance value for backwards compatibility.
func (st DBstore) SetManagerProperties(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error {
	recordType := o.ResourceType()
	recordKey := o.ResourceID()
	p := models.ManagerPropertiesToProvenance(m)

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		//nolint:staticcheck // not yet migrated to OpenFeature
		if st.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingProvenanceLockWrites) {
			return st.setManagerPropertiesWithLocking(sess, recordKey, recordType, org, m, p)
		}
		return st.setManagerPropertiesUpsert(sess, recordKey, recordType, org, m, p)
	})
}

func (st DBstore) setManagerPropertiesUpsert(sess *db.Session, recordKey, recordType string, org int64, m utils.ManagerProperties, p models.Provenance) error {
	upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
		provenanceRecord{}.TableName(),
		[]string{"record_key", "record_type", "org_id"},
		[]string{"record_key", "record_type", "org_id", "provenance", "manager_kind", "manager_identity"})

	params := []interface{}{
		recordKey,
		recordType,
		org,
		p,
		string(m.Kind),
		m.Identity,
	}

	_, err := sess.SQL(upsertSQL, params...).Query()
	if err != nil {
		return fmt.Errorf("failed to store manager properties: %w", err)
	}
	return nil
}

func (st DBstore) setManagerPropertiesWithLocking(sess *db.Session, recordKey, recordType string, org int64, m utils.ManagerProperties, p models.Provenance) error {
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
				"provenance":       p,
				"manager_kind":     string(m.Kind),
				"manager_identity": m.Identity,
			})
		if err != nil {
			return fmt.Errorf("failed to store manager properties: %w", err)
		}
		return nil
	}

	return st.setManagerPropertiesUpsert(sess, recordKey, recordType, org, m, p)
}
