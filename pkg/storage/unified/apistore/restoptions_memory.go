package apistore

import (
	badger "github.com/dgraph-io/badger/v4"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// NewRESTOptionsGetterMemory is kept until grafana-enterprise switches to restoptions; apistore
// becomes its own module after that and can no longer import the storage server.
//
// Deprecated: use restoptions.NewRESTOptionsGetterMemory.
func NewRESTOptionsGetterMemory(originalStorageConfig storagebackend.Config, secrets securevalue.InlineSecureValueSupport) (*RESTOptionsGetter, error) {
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

	return NewRESTOptionsGetterForClient(
		resource.NewLocalResourceClient(server),
		secrets,
		originalStorageConfig,
		nil,
		nil,
	), nil
}
