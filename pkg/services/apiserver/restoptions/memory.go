// Package restoptions builds apistore REST options getters backed by an in-process storage
// server. It stays in core because it needs the storage server, which apistore does not import.
package restoptions

import (
	"github.com/dgraph-io/badger/v4"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewRESTOptionsGetterMemory(originalStorageConfig storagebackend.Config, secrets securevalue.InlineSecureValueSupport) (*apistore.RESTOptionsGetter, error) {
	// Create BadgerDB with in-memory mode
	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithMemTableSize(256 << 10).  // 256KB memtable size
		WithValueThreshold(16 << 10). // 16KB threshold for storing values in LSM vs value log
		WithNumMemtables(2).          // Keep only 2 memtables in memory
		WithLogger(nil))
	if err != nil {
		return nil, err
	}

	kv := resource.NewBadgerKV(db)
	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore:                kv,
		Log:                    logging.DefaultLogger,
		DisableStorageServices: true,
	})
	if err != nil {
		return nil, err
	}

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	if err != nil {
		return nil, err
	}

	return apistore.NewRESTOptionsGetterForClient(
		resource.NewLocalResourceClient(server, nil),
		secrets,
		originalStorageConfig,
		nil,
		nil,
	), nil
}
