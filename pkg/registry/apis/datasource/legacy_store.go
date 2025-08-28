package datasource

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
	_ rest.CollectionDeleter    = (*legacyStorage)(nil)
)

type legacyStorage struct {
	datasources  PluginDatasourceProvider
	resourceInfo *utils.ResourceInfo
}

func (s *legacyStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.datasources.ListDataSources(ctx)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.datasources.GetDataSource(ctx, name)
}

// Create implements rest.Creater.
func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ds, ok := obj.(*v0alpha1.DataSource)
	if !ok {
		return nil, fmt.Errorf("expected a datasource object")
	}
	return s.datasources.CreateDataSource(ctx, ds)
}

// Update implements rest.Updater.
func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	ds, ok := obj.(*v0alpha1.DataSource)
	if !ok {
		return nil, false, fmt.Errorf("expected a datasource object")
	}

	oldDS, ok := obj.(*v0alpha1.DataSource)
	if !ok {
		return nil, false, fmt.Errorf("expected a datasource object (old)")
	}

	// Keep all the old secure values
	if len(oldDS.Secure) > 0 {
		for k, v := range oldDS.Secure {
			_, found := ds.Secure[k]
			if !found {
				ds.Secure[k] = v
			}
		}
	}

	ds, err = s.datasources.UpdateDataSource(ctx, ds)
	return ds, false, err
}

// Delete implements rest.GracefulDeleter.
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	err := s.datasources.DeleteDataSource(ctx, name)
	return nil, false, err
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	dss, err := s.datasources.ListDataSources(ctx)
	if err != nil {
		return nil, err
	}
	for _, ds := range dss.Items {
		if err = s.datasources.DeleteDataSource(ctx, ds.Name); err != nil {
			return nil, err
		}
	}
	return nil, nil
}
