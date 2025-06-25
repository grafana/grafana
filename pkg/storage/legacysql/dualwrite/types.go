package dualwrite

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// For *legacy* services, this will indicate if we have transitioned to Unified storage yet
type StorageStatus struct {
	Group        string `json:"group"`
	Resource     string `json:"resource"`
	WriteLegacy  bool   `json:"write_legacy"`
	WriteUnified bool   `json:"write_unified"`

	// Unified is the primary source (legacy may be secondary)
	ReadUnified bool `json:"read_unified"`

	// Timestamp when a migration finished
	Migrated int64 `json:"migrated" `

	// Timestamp when a migration *started* this should be cleared when finished
	// While migrating all write commands will be unavailable
	Migrating int64 `json:"migrating"`

	// When false, the behavior will not change at runtime
	Runtime bool `json:"runtime"`

	// UpdateKey used for optimistic locking -- requests to change the status must match previous value
	UpdateKey int64 `json:"update_key"`
}

func (status *StorageStatus) validate() bool {
	changed := false

	// Must write to unified if we are reading unified
	if status.ReadUnified && !status.WriteUnified {
		status.WriteUnified = true
		changed = true
	}

	// Make sure we are writing somewhere
	if !status.WriteLegacy && !status.WriteUnified {
		status.WriteLegacy = true
		changed = true
	}
	return changed
}

// Service is a service for managing the dual write storage
//
//go:generate mockery --name Service --structname MockService --inpackage --filename service_mock.go --with-expecter
type Service interface {
	ShouldManage(gr schema.GroupResource) bool

	// Create a managed k8s storage instance
	NewStorage(gr schema.GroupResource, legacy grafanarest.Storage, storage grafanarest.Storage) (grafanarest.Storage, error)

	// Check if the dual writes is reading from unified storage (mode3++)
	ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error)

	// Get status details for a Group/Resource
	Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error)

	// Start a migration process (writes will be locked)
	StartMigration(ctx context.Context, gr schema.GroupResource, key int64) (StorageStatus, error)

	// change the status (finish migration etc)
	Update(ctx context.Context, status StorageStatus) (StorageStatus, error)
}

type SearchAdapter struct {
	Service
}

func NewSearchAdapter(s Service) *SearchAdapter {
	return &SearchAdapter{Service: s}
}

func (d *SearchAdapter) IsEnabled(gr schema.GroupResource) bool {
	//nolint:errcheck
	status, _ := d.Status(context.Background(), gr)
	return status.Runtime && d.ShouldManage(gr)
}
