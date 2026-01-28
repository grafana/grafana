package integrationtypeschema

import (
	"context"

	"github.com/grafana/alerting/notify"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var _ grafanarest.Storage = (*legacyStorage)(nil)

type legacyStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return ResourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return ResourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return ResourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	// Get schemas from alerting library
	schemas := notify.GetSchemaForAllIntegrations()

	return ConvertToK8sResources(orgId, schemas, s.namespacer, opts.FieldSelector)
}

func (s *legacyStorage) Get(ctx context.Context, schemaType string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	schemas := notify.GetSchemaForAllIntegrations()

	for _, schema := range schemas {
		if string(schema.Type) == schemaType {
			return ConvertToK8sResource(info.OrgID, schema, s.namespacer)
		}
	}
	return nil, errors.NewNotFound(ResourceInfo.GroupResource(), schemaType)
}

// Write operations - return method not supported errors
func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "create")
}

func (s *legacyStorage) Update(ctx context.Context, uid string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "update")
}

func (s *legacyStorage) Delete(ctx context.Context, uid string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "delete")
}

func (s *legacyStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}
