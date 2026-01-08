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

// The setting is for all orgs
const globalKVOrgID = 0

// NOTE: this will replace any usage of "storage.dualwriting" and that will be removed
const globalKVNamespace = "unified.dualwrite"

func (m *keyvalueDB) get(ctx context.Context, gr schema.GroupResource) (status StorageStatus, ok bool, err error) {
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

	if status.validate() || save {
		err = m.set(ctx, status) // will be the default values
	}
	return status, ok, err
}

func (m *keyvalueDB) set(ctx context.Context, status StorageStatus) error {
	gr := schema.GroupResource{
		Group:    status.Group,
		Resource: status.Resource,
	}

	_ = status.validate()

	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	return m.db.Set(ctx, globalKVOrgID, globalKVNamespace, gr.String(), string(data))
}
