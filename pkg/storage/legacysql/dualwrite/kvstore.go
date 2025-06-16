package dualwrite

import (
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/infra/kvstore"
)

// Simple file implementation -- useful while testing and not yet sure about the SQL structure!
// When a path exists, read/write it from disk; otherwise it is held in memory
type keyvalueDB struct {
	db     kvstore.KVStore
	logger logging.Logger
	color  string
}

const globalKVOrgID = 0
const globalKVNamespace = "unified.dualwrite" // Does not conflict with "storage.dualwriting" used for requested state

// File implementation while testing -- values are saved in the data directory
func newKeyValueDB(kv kvstore.KVStore) *keyvalueDB {
	return &keyvalueDB{
		db:     kv,
		logger: logging.DefaultLogger.With("logger", "keyvalueDB"),
	}
}

func (m *keyvalueDB) Get(ctx context.Context, gr schema.GroupResource) (status StorageStatus, ok bool, err error) {
	val, ok, err := m.db.Get(ctx, globalKVOrgID, globalKVNamespace, gr.String())
	if err != nil {
		return status, false, err
	}

	save := !ok
	if ok {
		err = json.Unmarshal([]byte(val), &status)
		if err != nil {
			m.logger.Warn("error reading filedb", "err", err)
			save = true
		}
	}

	// Must write to unified if we are reading unified
	if status.ReadUnified && !status.WriteUnified {
		status.WriteUnified = true
		save = true
	}

	// Make sure we are writing something!
	if !status.WriteLegacy && !status.WriteUnified {
		status.WriteLegacy = true
		save = true
	}

	if save {
		err = m.Set(ctx, status) // will be the default values
	}
	return status, ok, err
}

func (m *keyvalueDB) Set(ctx context.Context, status StorageStatus) error {
	gr := schema.GroupResource{
		Group:    status.Group,
		Resource: status.Resource,
	}

	// Must write to unified if we are reading unified
	if status.ReadUnified && !status.WriteUnified {
		status.WriteUnified = true
	}

	// Make sure we are writing something!
	if !status.WriteLegacy && !status.WriteUnified {
		status.WriteLegacy = true
	}

	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	return m.db.Set(ctx, globalKVOrgID, globalKVNamespace, gr.String(), string(data))
}
