package rest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

var (
	_ rest.Storage              = (DualWriter)(nil)
	_ rest.Scoper               = (DualWriter)(nil)
	_ rest.TableConvertor       = (DualWriter)(nil)
	_ rest.CreaterUpdater       = (DualWriter)(nil)
	_ rest.CollectionDeleter    = (DualWriter)(nil)
	_ rest.GracefulDeleter      = (DualWriter)(nil)
	_ rest.SingularNameProvider = (DualWriter)(nil)
)

// Function that will create a dual writer
type DualWriteBuilder func(gr schema.GroupResource, legacy LegacyStorage, storage Storage) (Storage, error)

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
type Storage interface {
	rest.Storage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
	rest.Getter
	// TODO: when watch is implemented, we can replace all the below with rest.StandardStorage
	rest.Lister
	rest.CreaterUpdater
	rest.GracefulDeleter
	rest.CollectionDeleter
}

// LegacyStorage is a storage implementation that writes to the Grafana SQL database.
type LegacyStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.CreaterUpdater
	rest.Lister
	rest.GracefulDeleter
	rest.CollectionDeleter
	rest.TableConvertor
	rest.Getter
}

// DualWriter is a storage implementation that writes first to LegacyStorage and then to Storage.
// If writing to LegacyStorage fails, the write to Storage is skipped and the error is returned.
// Storage is used for all read operations.  This is useful as a migration step from SQL based
// legacy storage to a more standard kubernetes backed storage interface.
//
// NOTE: Only values supported by legacy storage will be preserved in the CREATE/UPDATE commands.
// For example, annotations, labels, and managed fields may not be preserved.  Everything in upstream
// storage can be recrated from the data in legacy storage.
//
// The LegacyStorage implementation must implement the following interfaces:
// - rest.Storage
// - rest.TableConvertor
// - rest.Scoper
// - rest.SingularNameProvider
//
// These interfaces are optional, but they all should be implemented to fully support dual writes:
// - rest.Creater
// - rest.Updater
// - rest.GracefulDeleter
// - rest.CollectionDeleter

type DualWriter interface {
	Storage
	LegacyStorage
	Mode() DualWriterMode
}

type DualWriterMode int

const (
	// Mode0 represents writing to and reading from solely LegacyStorage. This mode is enabled when the
	// Unified Storage is disabled. All reads and writes are made to LegacyStorage. None are made to Storage.
	Mode0 DualWriterMode = iota
	// Mode1 represents writing to and reading from LegacyStorage for all primary functionality while additionally
	// reading and writing to Storage on a best effort basis for the sake of collecting metrics.
	Mode1
	// Mode2 is the dual writing mode that represents writing to LegacyStorage and Storage and reading from LegacyStorage.
	// The objects written to storage will include any labels and annotations.
	// When reading values, the results will be from Storage when they exist, otherwise from legacy storage
	Mode2
	// Mode3 represents writing to LegacyStorage and Storage and reading from Storage.
	// NOTE: Requesting mode3 will only happen when after a background sync job succeeds
	Mode3
	// Mode4 represents writing and reading from Storage.
	// NOTE: Requesting mode4 will only happen when after a background sync job succeeds
	Mode4
	// Mode5 uses storage regardless of the background sync state
	Mode5
)

// TODO: make this function private as there should only be one public way of setting the dual writing mode
// NewDualWriter returns a new DualWriter.
func NewDualWriter(
	mode DualWriterMode,
	legacy LegacyStorage,
	storage Storage,
	reg prometheus.Registerer,
	resource string,
) Storage {
	metrics := &dualWriterMetrics{}
	metrics.init(reg)
	switch mode {
	case Mode0:
		return legacy
	case Mode1:
		// read and write only from legacy storage
		return newDualWriterMode1(legacy, storage, metrics, resource)
	case Mode2:
		// write to both, read from storage but use legacy as backup
		return newDualWriterMode2(legacy, storage, metrics, resource)
	case Mode3:
		// write to both, read from storage only
		return newDualWriterMode3(legacy, storage, metrics, resource)
	case Mode4, Mode5:
		return storage
	default:
		return newDualWriterMode1(legacy, storage, metrics, resource)
	}
}

type NamespacedKVStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

type ServerLockService interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func SetDualWritingMode(
	ctx context.Context,
	kvs NamespacedKVStore,
	cfg *SyncerConfig,
) (DualWriterMode, error) {
	if cfg == nil {
		return Mode0, errors.New("syncer config is nil")
	}
	// Mode0 means no DualWriter
	if cfg.Mode == Mode0 {
		return Mode0, nil
	}

	toMode := map[string]DualWriterMode{
		// It is not possible to initialize a mode 0 dual writer. Mode 0 represents
		// writing to legacy storage without Unified Storage enabled.
		"1": Mode1,
		"2": Mode2,
		"3": Mode3,
		"4": Mode4,
		"5": Mode5,
	}
	errDualWriterSetCurrentMode := errors.New("failed to set current dual writing mode")

	// Use entity name as key
	m, ok, err := kvs.Get(ctx, cfg.Kind)
	if err != nil {
		return Mode0, errors.New("failed to fetch current dual writing mode")
	}

	currentMode, exists := toMode[m]

	// If the mode does not exist in our mapping, we log an error.
	if !exists && ok {
		// Only log if "ok" because initially all instances will have mode unset for playlists.
		klog.Infof("invalid dual writing mode for %s mode: %v", cfg.Kind, m)
	}

	// If the mode does not exist in our mapping, and we also didn't find an entry for this kind, fallback.
	if !exists || !ok {
		// Default to mode 1
		currentMode = Mode1
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(currentMode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	}

	// Handle transitions to the desired mode.
	switch {
	case cfg.Mode == Mode2 || cfg.Mode == Mode1:
		// Directly set the mode for Mode1 and Mode2.
		currentMode = cfg.Mode
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(currentMode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	case cfg.Mode >= Mode3 && currentMode < Mode3:
		// Transitioning to Mode3 or higher requires data synchronization.
		cfgModeTmp := cfg.Mode
		// Before running the sync, set the syncer config to the current mode, as we have to run the syncer
		// once in the current active mode before we can upgrade.
		cfg.Mode = currentMode
		syncOk, err := runDataSyncer(ctx, cfg)
		// Once we are done with running the syncer, we can change the mode back on the config to the desired one.
		cfg.Mode = cfgModeTmp
		if err != nil {
			klog.Info("data syncer failed for mode:", m)
			return Mode0, err
		}
		if !syncOk {
			klog.Info("data syncer not ok for mode:", m)
			return currentMode, nil
		}
		// If sync is successful, update the mode to the desired one.
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(cfg.Mode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
		return cfg.Mode, nil
	case cfg.Mode >= Mode3 && currentMode >= Mode3:
		// If already in Mode3 or higher, simply update to the desired mode.
		currentMode = cfg.Mode
		if err := kvs.Set(ctx, cfg.Kind, fmt.Sprint(currentMode)); err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	default:
		// Handle any unexpected cases (should not normally happen).
		return Mode0, errDualWriterSetCurrentMode
	}
	return currentMode, nil
}

var defaultConverter = runtime.UnstructuredConverter(runtime.DefaultUnstructuredConverter)

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func Compare(storageObj, legacyObj runtime.Object) bool {
	if storageObj == nil || legacyObj == nil {
		return storageObj == nil && legacyObj == nil
	}
	return bytes.Equal(extractSpec(storageObj), extractSpec(legacyObj))
}

func extractSpec(obj runtime.Object) []byte {
	cpy := obj.DeepCopyObject()
	unstObj, err := defaultConverter.ToUnstructured(cpy)
	if err != nil {
		return nil
	}

	// we just want to compare the spec field
	jsonObj, err := json.Marshal(unstObj["spec"])
	if err != nil {
		return nil
	}
	return jsonObj
}

func getName(o runtime.Object) string {
	if o == nil {
		return ""
	}
	accessor, err := meta.Accessor(o)
	if err != nil {
		klog.Error("failed to get object name: ", err)
		return ""
	}
	return accessor.GetName()
}
