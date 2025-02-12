package modecheck

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// For *legacy* services, this will indicate if we have transitioned to Unified storage yet
type StorageStatus struct {
	Group        string `xorm:"group"`
	Resource     string `xorm:"resource"`
	WriteLegacy  bool   `xorm:"write_legacy"`
	WriteUnified bool   `xorm:"write_unified"`
	ReadUnified  bool   `xorm:"read_unified"`
	Migrated     int64  `xorm:"migrated"`  // required to read unified
	Migrating    int64  `xorm:"migrating"` // Writes are blocked while migrating
	Runtime      bool   `xorm:"runtime"`   // Support chaning the storage at runtime
	UpdateKey    int64  `xorm:"update_key"`
}

type Service interface {
	ReadUnified(ctx context.Context, gr schema.GroupResource) bool
	Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool)
	StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error)
	Update(ctx context.Context, status StorageStatus) (StorageStatus, error)
}

// The storage interface has zero business logic and simply writes values to a database
type StatusStorage interface {
	Get(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool)
	Set(ctx context.Context, status StorageStatus) (StorageStatus, error)
}

func ProvideModeChecker(db StatusStorage) Service {
	return &service{db}
}

type service struct {
	db StatusStorage
}

func (m *service) ReadUnified(ctx context.Context, gr schema.GroupResource) bool {
	v, ok := m.db.Get(ctx, gr)
	return ok && v.ReadUnified
}

// Status implements Service.
func (m *service) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool) {
	return m.db.Get(ctx, gr)
}

// StartMigration implements Service.
func (m *service) StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error) {
	now := time.Now().UnixMilli()
	v, ok := m.db.Get(ctx, gr)
	if ok {
		if v.Migrated > 0 {
			return v, fmt.Errorf("already migrated")
		}
		if key != v.UpdateKey {
			return v, fmt.Errorf("key mismatch")
		}
		if v.Migrating > 0 {
			return v, fmt.Errorf("migration in progress")
		}

		v.Migrating = now
		v.UpdateKey = v.UpdateKey + 1
		return m.db.Set(ctx, v)
	}

	return m.db.Set(ctx, StorageStatus{
		Group:        gr.Group,
		Resource:     gr.Resource,
		Runtime:      true,
		WriteLegacy:  true,
		WriteUnified: true,
		ReadUnified:  false,
		Migrating:    now,
		Migrated:     0, // timestamp
		UpdateKey:    1,
	})
}

// FinishMigration implements Service.
func (m *service) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	v, ok := m.db.Get(ctx, schema.GroupResource{Group: status.Group, Resource: status.Resource})
	if !ok {
		return v, fmt.Errorf("no running status")
	}
	if status.UpdateKey != v.UpdateKey {
		return v, fmt.Errorf("key mismatch")
	}
	if status.Migrating > 0 {
		return v, fmt.Errorf("update can not change migrating status")
	}
	if status.ReadUnified {
		if status.Migrated == 0 {
			return v, fmt.Errorf("can not read from unified before a migration")
		}
		if !status.WriteUnified {
			return v, fmt.Errorf("must write to unified when reading from unified")
		}
	}
	if !status.WriteLegacy && !status.WriteUnified {
		return v, fmt.Errorf("must write either legacy or unified")
	}

	return m.db.Set(ctx, v)
}
