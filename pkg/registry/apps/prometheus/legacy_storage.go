package prometheus

import (
	"context"
	"fmt"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	prometheus "github.com/grafana/grafana/apps/prometheus/pkg/apis/prometheus/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	datasources "github.com/grafana/grafana/pkg/services/datasources"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
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
)

type legacyStorage struct {
	service        *datasourceservice.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return prometheus.PrometheusKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(prometheus.PrometheusKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return prometheus.PrometheusKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// orgId, err := request.OrgIDForList(ctx)
	// if err != nil {
	// 	return nil, err
	// }

	res, err := s.service.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{}) // TODO maybe we need some org filter here?
	if err != nil {
		return nil, err
	}

	list := &prometheus.PrometheusList{}
	for idx := range res {
		list.Items = append(list.Items, *convertToK8sResource(res[idx], s.namespacer))
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		Name:  name,
		OrgID: info.OrgID,
	})
	if err != nil || dto == nil {
		if err == nil {
			err = k8serrors.NewNotFound(schema.GroupResource{
				Group:    prometheus.PrometheusKind().Group(),
				Resource: prometheus.PrometheusKind().Plural(),
			}, name)
		}
		return nil, err
	}

	return convertToK8sResource(dto, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*prometheus.Prometheus)
	if !ok {
		return nil, fmt.Errorf("expected prometheus?")
	}
	cmd, err := convertToLegacyUpdateCommand(p, info.OrgID)
	if err != nil {
		return nil, err
	}
	out, err := s.service.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		UID:  p.Name,
		Name: cmd.Name,
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.UID, nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}
	p, ok := obj.(*prometheus.Prometheus)
	if !ok {
		return nil, created, fmt.Errorf("expected prometheus after update")
	}

	cmd, err := convertToLegacyUpdateCommand(p, info.OrgID)
	if err != nil {
		return old, created, err
	}
	_, err = s.service.UpdateDataSource(ctx, cmd)
	if err != nil {
		return nil, false, err
	}

	r, err := s.Get(ctx, name, nil)
	return r, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	p, ok := v.(*prometheus.Prometheus)
	if !ok {
		return v, false, fmt.Errorf("expected a prometheus response from Get")
	}
	err = s.service.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{
		UID:   name,
		OrgID: info.OrgID,
	})
	return p, true, err // true is instant delete
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for prometheus not implemented")
}
