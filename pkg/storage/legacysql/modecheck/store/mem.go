package store

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/legacysql/modecheck"
)

// not a real DB!
type memDB struct {
	db map[string]modecheck.StorageStatus
	mu sync.RWMutex
}

func ProvideStorage() modecheck.StatusStorage {
	return &memDB{
		db: make(map[string]modecheck.StorageStatus),
	}
}

func (m *memDB) Get(ctx context.Context, gr schema.GroupResource) (modecheck.StorageStatus, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.db[gr.String()]
	return v, ok
}

func (m *memDB) Set(ctx context.Context, status modecheck.StorageStatus) (modecheck.StorageStatus, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	gr := schema.GroupResource{
		Group:    status.Group,
		Resource: status.Resource,
	}
	status.UpdateKey = status.UpdateKey + 1
	m.db[gr.String()] = status
	return status, nil
}
