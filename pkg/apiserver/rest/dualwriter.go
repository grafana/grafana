package rest

import (
	"bytes"
	"encoding/json"

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
