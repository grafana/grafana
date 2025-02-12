package dualwrite

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// For *legacy* services, this will indicate if we have transitioned to Unified storage yet
type StorageStatus struct {
	Group        string `json:"group"         xorm:"group"`
	Resource     string `json:"resource"      xorm:"resource"`
	WriteLegacy  bool   `json:"write_legacy"  xorm:"write_legacy"`
	WriteUnified bool   `json:"write_unified" xorm:"write_unified"`
	ReadUnified  bool   `json:"read_unified"  xorm:"read_unified"`
	Migrated     int64  `json:"migrated"      xorm:"migrated"`  // required to read unified
	Migrating    int64  `json:"migrating"     xorm:"migrating"` // Writes are blocked while migrating
	Runtime      bool   `json:"runtime"       xorm:"runtime"`   // Support chaning the storage at runtime
	UpdateKey    int64  `json:"update_key"    xorm:"update_key"`
}

type Service interface {
	ShouldManage(gr schema.GroupResource) bool
	NewStorage(gr schema.GroupResource, legacy grafanarest.LegacyStorage, storage grafanarest.Storage) (grafanarest.Storage, error)

	// Check if the dual writes is reading from unified storage (mode3++)
	ReadFromUnified(ctx context.Context, gr schema.GroupResource) bool
	Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool)
	StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error)
	Update(ctx context.Context, status StorageStatus) (StorageStatus, error)
}
