package dualwrite

import (
	"context"
	"encoding/json"
	"os"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
)

// Simple file implementation -- useful while testing and not yet sure about the SQL structure!
// When a path exists, read/write it from disk
type fileDB struct {
	path    string
	changed int64
	db      map[string]StorageStatus
	mu      sync.RWMutex
	logger  logging.Logger
}

// File implementation while testing -- values are saved in the data directory
func newFileDB(path string) *fileDB {
	return &fileDB{
		db:     make(map[string]StorageStatus),
		path:   path,
		logger: logging.DefaultLogger.With("logger", "fileDB"),
	}
}

func (m *fileDB) Get(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	info, err := os.Stat(m.path)
	if err == nil && info.ModTime().UnixMilli() != m.changed {
		v, err := os.ReadFile(m.path)
		if err == nil {
			err = json.Unmarshal(v, &m.db)
			m.changed = info.ModTime().UnixMilli()
		}
		if err != nil {
			m.logger.Warn("error reading filedb", "err", err)
		}
		for k, v := range m.db {
			// Must write to unified if we are reading unified
			if v.ReadUnified && !v.WriteUnified {
				v.WriteUnified = true
				m.db[k] = v
			}

			// Make sure we are writing something!
			if !(v.WriteLegacy || v.WriteUnified) {
				v.WriteLegacy = true
				m.db[k] = v
			}
		}
	}

	v, ok := m.db[gr.String()]
	return v, ok
}

func (m *fileDB) Set(ctx context.Context, status StorageStatus) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	gr := schema.GroupResource{
		Group:    status.Group,
		Resource: status.Resource,
	}
	m.db[gr.String()] = status

	if m.path != "" {
		data, err := json.MarshalIndent(m.db, "", "  ")
		if err != nil {
			return err
		}
		err = os.WriteFile(m.path, data, 0644)
		if err != nil {
			return err
		}
	}

	return nil
}
