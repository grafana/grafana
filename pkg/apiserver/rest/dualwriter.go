package rest

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*DualWrite)(nil)
	_ rest.Scoper               = (*DualWrite)(nil)
	_ rest.TableConvertor       = (*DualWrite)(nil)
	_ rest.CreaterUpdater       = (*DualWrite)(nil)
	_ rest.CollectionDeleter    = (*DualWrite)(nil)
	_ rest.GracefulDeleter      = (*DualWrite)(nil)
	_ rest.SingularNameProvider = (*DualWrite)(nil)
)

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
type Storage interface {
	rest.Storage
	rest.StandardStorage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
	rest.Getter
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

type DualWrite struct{ DualWriter }

var errDualWriterCreaterMissing = errors.New("legacy storage rest.Creater is missing")
var errDualWriterListerMissing = errors.New("legacy storage rest.Lister is missing")
var errDualWriterDeleterMissing = errors.New("legacy storage rest.GracefulDeleter is missing")
var errDualWriterCollectionDeleterMissing = errors.New("legacy storage rest.CollectionDeleter is missing")
var errDualWriterUpdaterMissing = errors.New("legacy storage rest.Updater is missing")

const (
	Mode1 = iota
	Mode2
	Mode3
	Mode4
)

var CurrentMode = Mode2

// #TODO make CurrentMode customisable and specific to each entity

// NewDualWriter returns a new DualWriter.
func NewDualWriter(legacy LegacyStorage, storage Storage) DualWrite {
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

func selectDualWriter(mode int, legacy LegacyStorage, storage Storage) DualWrite {
	switch mode {
	case Mode1:
		dw := NewDualWriterMode1(legacy, storage)
		return DualWrite{dw}
	case Mode2:
		dw := NewDualWriterMode2(legacy, storage)
		return DualWrite{dw}
	case Mode3:
		dw := NewDualWriterMode3(legacy, storage)
		return DualWrite{dw}
	case Mode4:
		dw := NewDualWriterMode4(legacy, storage)
		return DualWrite{dw}
	default:
		dw := NewDualWriterMode1(legacy, storage)
		return DualWrite{dw}
	}
}
