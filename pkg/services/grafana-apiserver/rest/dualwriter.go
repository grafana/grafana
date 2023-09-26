package rest

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ rest.Storage = (*DualWriter)(nil)
var _ rest.Scoper = (*DualWriter)(nil)
var _ rest.TableConvertor = (*DualWriter)(nil)
var _ rest.CreaterUpdater = (*DualWriter)(nil)
var _ rest.CollectionDeleter = (*DualWriter)(nil)
var _ rest.GracefulDeleter = (*DualWriter)(nil)
var _ rest.SingularNameProvider = (*DualWriter)(nil)

type UnifiedStorage interface {
	rest.Storage
	rest.StandardStorage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
}

type SQLStorage interface {
	rest.CreaterUpdater
	rest.CollectionDeleter
	rest.GracefulDeleter
}

// DualWriter is a storage implementation that writes to both SQLStorage and UnifiedStorage
type DualWriter struct {
	UnifiedStorage
	sql SQLStorage
}

func NewDualWriter(sql SQLStorage, unified UnifiedStorage) *DualWriter {
	return &DualWriter{
		UnifiedStorage: unified,
		sql:            sql,
	}
}

// Create overrides the default behavior of the UnifiedStorage and writes to both the SQLStorage and UnifiedStorage
func (d *DualWriter) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	_, err := d.sql.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}

	obj, err = d.UnifiedStorage.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}

	return obj, nil
}

// Update overrides the default behavior of the UnifiedStorage and writes to both the SQLStorage and UnifiedStorage
func (d *DualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	_, _, err := d.sql.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return nil, false, err
	}

	obj, created, err := d.UnifiedStorage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return nil, false, err
	}

	return obj, created, nil
}

// Delete overrides the default behavior of the UnifiedStorage and delete from both the SQLStorage and UnifiedStorage
func (d *DualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	_, _, err := d.sql.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return nil, false, err
	}

	obj, deleted, err := d.UnifiedStorage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return nil, false, err
	}

	return obj, deleted, nil
}

// DeleteCollection overrides the default behavior of the UnifiedStorage and writes to both the SQLStorage and UnifiedStorage
func (d *DualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	_, err := d.sql.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		return nil, err
	}

	obj, err := d.UnifiedStorage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		return nil, err
	}

	return obj, nil
}
