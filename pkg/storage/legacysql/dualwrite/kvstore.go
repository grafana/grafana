package dualwrite

import (
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/infra/kvstore"
)

type keyvalueDB struct {
	db     kvstore.KVStore
	logger logging.Logger
}

const globalKVOrgID = 0
const globalKVNamespace = "unified.dualwrite" // Does not conflict with "storage.dualwriting" used for requested state

func newKeyValueDB(kv kvstore.KVStore) *keyvalueDB {
	return &keyvalueDB{
		db:     kv,
		logger: logging.DefaultLogger.With("logger", "dualwrite.db"),
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
