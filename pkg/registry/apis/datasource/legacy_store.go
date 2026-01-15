package datasource

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
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
	datasources                     PluginDatasourceProvider
	resourceInfo                    *utils.ResourceInfo
	dsConfigHandlerRequestsDuration *prometheus.HistogramVec
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
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.List"), time.Since(start).Seconds())
		}()
	}
	return s.datasources.ListDataSources(ctx)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.Get"), time.Since(start).Seconds())
		}()
	}

	return s.datasources.GetDataSource(ctx, name)
}

// Create implements rest.Creater.
func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.Create"), time.Since(start).Seconds())
		}()
	}

	ds, ok := obj.(*v0alpha1.DataSource)
	if !ok {
		return nil, fmt.Errorf("expected a datasource object")
	}

	// Verify the secure value commands. While we're using dual writer, we can only support raw secret values and not references to secrets that already exist. This is because we need the raw values to write to the legacy store.
	for _, v := range ds.Secure {
		if v.Create.IsZero() {
			return nil, fmt.Errorf("a raw secure value is required until datasources have been fully migrated to unified storage")
		}
		if v.Remove {
			return nil, fmt.Errorf("secure values can not use remove when creating a new datasource")
		}
		if v.Name != "" {
			return nil, fmt.Errorf("secure values can not specify a name when creating a new datasource")
		}
	}

	return s.datasources.CreateDataSource(ctx, ds)
}

// Update implements rest.Updater.
func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.Update"), time.Since(start).Seconds())
		}()
	}

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

	// Expose any secure value changes to the dual writer
	var secureChanges common.InlineSecureValues
	for k, v := range ds.Secure {
		if v.Remove || v.Create != "" {
			if secureChanges == nil {
				secureChanges = make(common.InlineSecureValues)
			}
			secureChanges[k] = v

			// Attach any changes the the context so the DualWrite wrapper can apply
			// the same changes in unified storage further down the request pipeline.
			// See: https://github.com/grafana/grafana/blob/dual-write-inline-secure-values/pkg/storage/legacysql/dualwrite/dualwriter.go
			dualwrite.SetUpdatedSecureValues(ctx, ds.Secure)
			continue
		}

		// The legacy store must use fixed names generated by the internal system
		// we can not support external shared secrets when using the SQL backing for datasources
		validName := getLegacySecureValueName(name, k)
		if v.Name != validName {
			return nil, false, fmt.Errorf("invalid secure value name %q, expected %q", v.Name, validName)
		}
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
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.Delete"), time.Since(start).Seconds())
		}()
	}

	err := s.datasources.DeleteDataSource(ctx, name)
	return nil, false, err
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	if s.dsConfigHandlerRequestsDuration != nil {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, s.dsConfigHandlerRequestsDuration.WithLabelValues("legacyStorage.DeleteCollection"), time.Since(start).Seconds())
		}()
	}

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
