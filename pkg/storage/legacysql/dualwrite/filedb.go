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
// When a path exists, read/write it from disk; otherwise it is held in memory
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

func (m *fileDB) Get(ctx context.Context, gr schema.GroupResource) (StorageStatus, bool, error) {
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

		changed := false
		for k, v := range m.db {
			// Must write to unified if we are reading unified
			if v.ReadUnified && !v.WriteUnified {
				v.WriteUnified = true
				m.db[k] = v
				changed = true
			}

			// Make sure we are writing something!
			if !v.WriteLegacy && !v.WriteUnified {
				v.WriteLegacy = true
				m.db[k] = v
				changed = true
			}
		}
		if changed {
			err = m.save()
			m.logger.Warn("error saving changes filedb", "err", err)
		}
	}

	v, ok := m.db[gr.String()]
	return v, ok, nil
}

func (m *fileDB) Set(ctx context.Context, status StorageStatus) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	gr := schema.GroupResource{
		Group:    status.Group,
		Resource: status.Resource,
	}
	m.db[gr.String()] = status

	return m.save()
}

func (m *fileDB) save() error {
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
