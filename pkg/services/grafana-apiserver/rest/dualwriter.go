package rest

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*DualWriter)(nil)
	_ rest.Scoper               = (*DualWriter)(nil)
	_ rest.TableConvertor       = (*DualWriter)(nil)
	_ rest.CreaterUpdater       = (*DualWriter)(nil)
	_ rest.CollectionDeleter    = (*DualWriter)(nil)
	_ rest.GracefulDeleter      = (*DualWriter)(nil)
	_ rest.SingularNameProvider = (*DualWriter)(nil)
)

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
type Storage interface {
	rest.Storage
	rest.StandardStorage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
}

// LegacyStorage is a storage implementation that writes to the Grafana SQL database.
type LegacyStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.TableConvertor
}

// DualWriter is a storage implementation that writes first to LegacyStorage and then to Storage.
// If writing to LegacyStorage fails, the write to Storage is skipped and the error is returned.
// Storage is used for all read operations.
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
type DualWriter struct {
	Storage
	legacy LegacyStorage
}

// NewDualWriter returns a new DualWriter.
func NewDualWriter(legacy LegacyStorage, storage Storage) *DualWriter {
	return &DualWriter{
		Storage: storage,
		legacy:  legacy,
	}
}

// Create overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage.
func (d *DualWriter) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if legacy, ok := d.legacy.(rest.Creater); ok {
		_, err := legacy.Create(ctx, obj, createValidation, options)
		if err != nil {
			return nil, err
		}
	}

	return d.Storage.Create(ctx, obj, createValidation, options)
}

// Update overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage.
func (d *DualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if legacy, ok := d.legacy.(rest.Updater); ok {
		_, _, err := legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
		if err != nil {
			return nil, false, err
		}
	}

	return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// Delete overrides the default behavior of the Storage and delete from both the LegacyStorage and Storage.
func (d *DualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if legacy, ok := d.legacy.(rest.GracefulDeleter); ok {
		_, _, err := legacy.Delete(ctx, name, deleteValidation, options)
		if err != nil {
			return nil, false, err
		}
	}

	return d.Storage.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the default behavior of the Storage and delete from both the LegacyStorage and Storage.
func (d *DualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	if legacy, ok := d.legacy.(rest.CollectionDeleter); ok {
		_, err := legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
		if err != nil {
			return nil, err
		}
	}

	return d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
}
