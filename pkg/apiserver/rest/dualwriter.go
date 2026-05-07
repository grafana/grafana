package rest

import (
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Function that will create a dual writer
type DualWriteBuilder func(gr schema.GroupResource, legacy Storage, unified Storage) (Storage, error)

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
	// When reading values, the results will be from LegacyStorage.
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

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func Compare(objA, objB runtime.Object) bool {
	if objA == nil || objB == nil {
		return objA == nil && objB == nil
	}
	if objA == objB {
		return true
	}
	mA, err := utils.MetaAccessor(objA)
	if err != nil {
		return false
	}
	mB, err := utils.MetaAccessor(objB)
	if err != nil {
		return false
	}
	sA, err := mA.GetSpec()
	if err != nil {
		return false
	}
	sB, err := mB.GetSpec()
	if err != nil {
		return false
	}
	return apiequality.Semantic.DeepEqual(sA, sB)
}
