package rest

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
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
}

type DualWriterMode int

var errDualWriterCreaterMissing = errors.New("legacy storage rest.Creater is missing")
var errDualWriterListerMissing = errors.New("legacy storage rest.Lister is missing")
var errDualWriterDeleterMissing = errors.New("legacy storage rest.GracefulDeleter is missing")
var errDualWriterCollectionDeleterMissing = errors.New("legacy storage rest.CollectionDeleter is missing")
var errDualWriterUpdaterMissing = errors.New("legacy storage rest.Updater is missing")

const (
	Mode1 DualWriterMode = iota
	Mode2
	Mode3
	Mode4
)

var CurrentMode = Mode2

//TODO: make CurrentMode customisable and specific to each entity
// change DualWriter signature to get the current mode as an argument

// NewDualWriter returns a new DualWriter.
func NewDualWriter(legacy LegacyStorage, storage Storage) DualWriter {
	return selectDualWriter(CurrentMode, legacy, storage)
}

type updateWrapper struct {
	upstream rest.UpdatedObjectInfo
	updated  runtime.Object
}

// Returns preconditions built from the updated object, if applicable.
// May return nil, or a preconditions object containing nil fields,
// if no preconditions can be determined from the updated object.
func (u *updateWrapper) Preconditions() *metav1.Preconditions {
	return u.upstream.Preconditions()
}

// UpdatedObject returns the updated object, given a context and old object.
// The only time an empty oldObj should be passed in is if a "create on update" is occurring (there is no oldObj).
func (u *updateWrapper) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	return u.updated, nil
}

func selectDualWriter(mode DualWriterMode, legacy LegacyStorage, storage Storage) DualWriter {
	switch mode {
	case Mode1:
		// read and write only from legacy storage
		return NewDualWriterMode1(legacy, storage)
	case Mode2:
		// write to both, read from storage but use legacy as backup
		return NewDualWriterMode2(legacy, storage)
	case Mode3:
		// write to both, read from storage only
		return NewDualWriterMode3(legacy, storage)
	case Mode4:
		// read and write only from storage
		return NewDualWriterMode4(legacy, storage)
	default:
		return NewDualWriterMode1(legacy, storage)
	}
}
