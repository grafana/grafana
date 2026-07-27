package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"iter"

	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const pendingDeleteSection = kvpkg.PendingDeleteSection

// PendingDeleteRecord is the JSON blob stored in the KV store for a tenant
// that has been marked as pending deletion. The record is created before
// labelling begins so that cleanup can proceed even after partial failures.
//
// When Orphaned is true, the record cannot be removed by the tenant watcher.
// This is used for manually-seeded records that clean up orphaned tenants
// which the tenant API considers active but are actually deleted in GCOM.
type PendingDeleteRecord struct {
	DeleteAfter      string `json:"deleteAfter"`
	LabelingComplete bool   `json:"labelingComplete"`
	Orphaned         bool   `json:"orphaned,omitempty"`
	// DeletedAt is set to an RFC3339 timestamp after all tenant data has been
	// successfully deleted. Records with this field set are skipped by the
	// tenant deleter.
	DeletedAt string `json:"deletedAt,omitempty"`
}

// PendingDeleteStore manages pending-delete records in the KV store.
type PendingDeleteStore struct {
	kv KV
}

func newPendingDeleteStore(kv KV) *PendingDeleteStore {
	return &PendingDeleteStore{kv: kv}
}

// Names streams tenant names that currently have pending-delete records.
func (s *PendingDeleteStore) Names(ctx context.Context) iter.Seq2[string, error] {
	return s.kv.Keys(ctx, pendingDeleteSection, ListOptions{})
}

// Get retrieves the PendingDeleteRecord for a tenant. Returns ErrNotFound if
// no record exists.
func (s *PendingDeleteStore) Get(ctx context.Context, name string) (PendingDeleteRecord, error) {
	reader, err := s.kv.Get(ctx, pendingDeleteSection, name)
	if err != nil {
		return PendingDeleteRecord{}, err
	}
	data, err := io.ReadAll(reader)
	_ = reader.Close()
	if err != nil {
		return PendingDeleteRecord{}, fmt.Errorf("reading pending delete record: %w", err)
	}

	var record PendingDeleteRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return PendingDeleteRecord{}, fmt.Errorf("unmarshaling pending delete record: %w", err)
	}
	return record, nil
}

// Upsert creates or replaces the PendingDeleteRecord for a tenant.
func (s *PendingDeleteStore) Upsert(ctx context.Context, name string, record PendingDeleteRecord) error {
	writer, err := s.kv.Save(ctx, pendingDeleteSection, name)
	if err != nil {
		return fmt.Errorf("opening writer: %w", err)
	}
	if err := json.NewEncoder(writer).Encode(record); err != nil {
		_ = writer.Close()
		return fmt.Errorf("encoding record: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("closing writer: %w", err)
	}
	return nil
}

// Delete removes the PendingDeleteRecord for a tenant.
func (s *PendingDeleteStore) Delete(ctx context.Context, name string) error {
	return s.kv.Delete(ctx, pendingDeleteSection, name)
}
