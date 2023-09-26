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

// UnifiedStorage is a storage implementation that writes to the Grafana Unified Storage.
type UnifiedStorage interface {
	rest.Storage
	rest.StandardStorage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
}

// SQLStorage is a storage implementation that writes to the Grafana SQL database.
type SQLStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.TableConvertor
}

// DualWriter is a storage implementation that writes first to SQLStorage and then to UnifiedStorage.
// If writing to SQLStorage fails, the write to UnifiedStorage is skipped and the error is returned.
// UnifiedStorage is used for all read operations.
//
// The SQLStorage implementation must implement the following interfaces:
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
	UnifiedStorage
	sql SQLStorage
}

// NewDualWriter returns a new DualWriter.
func NewDualWriter(sql SQLStorage, unified UnifiedStorage) *DualWriter {
	return &DualWriter{
		UnifiedStorage: unified,
		sql:            sql,
	}
}

// Create overrides the default behavior of the UnifiedStorage and writes to both the SQLStorage and UnifiedStorage.
func (d *DualWriter) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	// only dual write if the SQLStorage implements Creater
	if sql, ok := d.sql.(rest.Creater); ok {
		_, err := sql.Create(ctx, obj, createValidation, options)
		if err != nil {
			return nil, err
		}
	}

	return d.UnifiedStorage.Create(ctx, obj, createValidation, options)
}

// Update overrides the default behavior of the UnifiedStorage and writes to both the SQLStorage and UnifiedStorage.
func (d *DualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// only dual write if the SQLStorage implements Updater
	if sql, ok := d.sql.(rest.Updater); ok {
		_, _, err := sql.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
		if err != nil {
			return nil, false, err
		}
	}

	return d.UnifiedStorage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// Delete overrides the default behavior of the UnifiedStorage and delete from both the SQLStorage and UnifiedStorage.
func (d *DualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// only dual write if the SQLStorage implements GracefulDeleter
	if sql, ok := d.sql.(rest.GracefulDeleter); ok {
		_, _, err := sql.Delete(ctx, name, deleteValidation, options)
		if err != nil {
			return nil, false, err
		}
	}

	return d.UnifiedStorage.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the default behavior of the UnifiedStorage and delete from both the SQLStorage and UnifiedStorage.
func (d *DualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	// only dual write if the SQLStorage implements CollectionDeleter
	if sql, ok := d.sql.(rest.CollectionDeleter); ok {
		_, err := sql.DeleteCollection(ctx, deleteValidation, options, listOptions)
		if err != nil {
			return nil, err
		}
	}

	return d.UnifiedStorage.DeleteCollection(ctx, deleteValidation, options, listOptions)
}
