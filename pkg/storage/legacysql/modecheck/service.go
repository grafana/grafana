package modecheck

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// For *legacy* services, this will indicate if we have transitioned to Unified storage yet
type StorageStatus struct {
	Group     string `xorm:"group"`
	Resource  string `xorm:"resource"`
	Primary   string `xorm:"primary"`   // legacy | unified
	Secondary string `xorm:"secondary"` // legacy | unified | ""
	Migrated  int64  `xorm:"migrated"`  // unified can be primary
	Migrating int64  `xorm:"migrating"` // Writes are blocked while migrating
	Startup   bool   `xorm:"startup"`   // Pick a fixed mode at startup
	UpdateKey int64  `xorm:"update_key"`
}

type Service interface {
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
		if v.Migrating > 0 && time.Since(time.UnixMilli(v.Migrating)) < time.Minute*5 {
			return v, fmt.Errorf("already migrating")
		}

		v.Migrating = now
		v.UpdateKey = v.UpdateKey + 1
		return m.db.Set(ctx, v)
	}

	return m.db.Set(ctx, StorageStatus{
		Group:     gr.Group,
		Resource:  gr.Resource,
		Migrating: now,
		Migrated:  0, // timestamp
		UpdateKey: 1,
	})
}

// FinishMigration implements Service.
func (m *service) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	v, ok := m.db.Get(ctx, schema.GroupResource{Group: status.Group, Resource: status.Resource})
	if !ok {
		return StorageStatus{}, fmt.Errorf("no running status")
	}
	if status.UpdateKey != v.UpdateKey {
		return v, fmt.Errorf("key mismatch")
	}
	if status.Migrating > 0 {
		return v, fmt.Errorf("update can not set migrating status")
	}
	return m.db.Set(ctx, v)
}
