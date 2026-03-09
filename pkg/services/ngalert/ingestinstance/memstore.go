package ingestinstance

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

var _ Store = (*MemStore)(nil)

// MemStore is an in-memory implementation of Store for testing.
// Not suitable for production — data is lost on restart.
type MemStore struct {
	mu      sync.RWMutex
	byToken map[string]*Instance
	byOrg   map[int64]map[string]*Instance // orgID → token → instance
}

// NewMemStore creates an empty in-memory store.
func NewMemStore() *MemStore {
	return &MemStore{
		byToken: make(map[string]*Instance),
		byOrg:   make(map[int64]map[string]*Instance),
	}
}

func copyInstance(inst *Instance) *Instance {
	cp := *inst
	if inst.Settings != nil {
		cp.Settings = make(json.RawMessage, len(inst.Settings))
		copy(cp.Settings, inst.Settings)
	}
	return &cp
}

func (s *MemStore) GetByToken(_ context.Context, token string) (*Instance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	inst, ok := s.byToken[token]
	if !ok {
		return nil, ErrInstanceNotFound
	}
	return copyInstance(inst), nil
}

func (s *MemStore) Create(_ context.Context, instance *Instance) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.byToken[instance.Token]; exists {
		return fmt.Errorf("token %q already exists", instance.Token)
	}

	now := time.Now()
	stored := copyInstance(instance)
	stored.CreatedAt = now
	stored.UpdatedAt = now

	s.byToken[stored.Token] = stored

	orgInstances, ok := s.byOrg[stored.OrgID]
	if !ok {
		orgInstances = make(map[string]*Instance)
		s.byOrg[stored.OrgID] = orgInstances
	}
	orgInstances[stored.Token] = stored

	return nil
}

func (s *MemStore) Update(_ context.Context, orgID int64, token string, name string, settings json.RawMessage) (*Instance, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	inst, ok := s.byToken[token]
	if !ok || inst.OrgID != orgID {
		return nil, ErrInstanceNotFound
	}

	inst.Name = name
	inst.Settings = settings
	inst.UpdatedAt = time.Now()

	return copyInstance(inst), nil
}

func (s *MemStore) Delete(_ context.Context, orgID int64, token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	inst, ok := s.byToken[token]
	if !ok || inst.OrgID != orgID {
		return ErrInstanceNotFound
	}

	delete(s.byToken, token)
	if orgInstances, ok := s.byOrg[orgID]; ok {
		delete(orgInstances, token)
		if len(orgInstances) == 0 {
			delete(s.byOrg, orgID)
		}
	}

	return nil
}

func (s *MemStore) ListByOrg(_ context.Context, orgID int64) ([]*Instance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	orgInstances, ok := s.byOrg[orgID]
	if !ok {
		return []*Instance{}, nil
	}

	result := make([]*Instance, 0, len(orgInstances))
	for _, inst := range orgInstances {
		result = append(result, copyInstance(inst))
	}
	return result, nil
}
