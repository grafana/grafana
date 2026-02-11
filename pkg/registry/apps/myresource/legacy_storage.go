package myresource

import (
	"context"
	"fmt"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return myresource.MyResourceKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(myresource.MyResourceKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return myresource.MyResourceKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// No legacy data for this dummy resource
	return &myresource.MyResourceList{}, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, k8serrors.NewNotFound(myresource.MyResourceKind().GroupVersionResource().GroupResource(), name)
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, fmt.Errorf("legacy create not supported for myresource")
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("legacy update not supported for myresource")
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, k8serrors.NewNotFound(myresource.MyResourceKind().GroupVersionResource().GroupResource(), name)
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for myresource not implemented")
}
