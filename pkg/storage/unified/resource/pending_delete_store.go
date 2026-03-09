package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	pendingDeleteSection  = kvpkg.PendingDeleteSection
	pendingDeleteCacheTTL = 5 * time.Minute
)

// PendingDeleteRecord is the JSON blob stored in the KV store for a tenant
// that has been marked as pending deletion. The existence of a record implies
// that all the tenant's resources have been labelled.
type PendingDeleteRecord struct {
	DeleteAfter string `json:"deleteAfter"`
}

// PendingDeleteStore manages pending-delete records in the KV store and keeps
// an in-memory cache of which tenants have records so that the common-path
// "tenant is not pending delete" check is a map lookup with no I/O.
type PendingDeleteStore struct {
	kv          KV
	cachedSet   map[string]struct{}
	cacheExpiry time.Time
}

func newPendingDeleteStore(kv KV) *PendingDeleteStore {
	return &PendingDeleteStore{kv: kv}
}

// RefreshCache reloads the set of pending-delete tenant names from the KV
// store if the cache has expired.
func (s *PendingDeleteStore) RefreshCache(ctx context.Context) {
	if time.Now().Before(s.cacheExpiry) {
		return
	}

	set := make(map[string]struct{})
	for key, err := range s.kv.Keys(ctx, pendingDeleteSection, ListOptions{}) {
		if err != nil {
			return
		}
		set[key] = struct{}{}
	}

	s.cachedSet = set
	s.cacheExpiry = time.Now().Add(pendingDeleteCacheTTL)
}

// Has returns whether a tenant has a pending-delete record according to the
// in-memory cache.
func (s *PendingDeleteStore) Has(name string) bool {
	_, ok := s.cachedSet[name]
	return ok
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

// Upsert creates or replaces the PendingDeleteRecord for a tenant and adds it
// to the cache.
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

	if s.cachedSet == nil {
		s.cachedSet = make(map[string]struct{})
	}
	s.cachedSet[name] = struct{}{}

	return nil
}

// Delete removes the PendingDeleteRecord for a tenant and removes it from the
// cache.
func (s *PendingDeleteStore) Delete(ctx context.Context, name string) error {
	if err := s.kv.Delete(ctx, pendingDeleteSection, name); err != nil {
		return err
	}

	delete(s.cachedSet, name)

	return nil
}
