package app

import (
	"context"
	"strings"

	v0alpha1 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.Scoper               = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.SingularNameProvider = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.Getter               = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.Lister               = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.TableConvertor       = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.Creater              = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.Updater              = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.GracefulDeleter      = (*SimpleLegacyAnnotationStorage)(nil)
	_ rest.CollectionDeleter    = (*SimpleLegacyAnnotationStorage)(nil)
)

type SimpleLegacyAnnotationStorage struct {
	legacyService  annotations.Repository
	tableConverter rest.TableConvertor
}

func NewSimpleLegacyAnnotationStorage(legacyService annotations.Repository) *SimpleLegacyAnnotationStorage {
	return &SimpleLegacyAnnotationStorage{
		legacyService: legacyService,
	}
}

func (s *SimpleLegacyAnnotationStorage) SetTableConverter(converter rest.TableConvertor) {
	s.tableConverter = converter
}

func (s *SimpleLegacyAnnotationStorage) New() runtime.Object {
	return &v0alpha1.Annotation{}
}

func (s *SimpleLegacyAnnotationStorage) NewList() runtime.Object {
	return &v0alpha1.AnnotationList{}
}

func (s *SimpleLegacyAnnotationStorage) Destroy() {}

func (s *SimpleLegacyAnnotationStorage) NamespaceScoped() bool {
	return true // annotations are namespaced by org
}

func (s *SimpleLegacyAnnotationStorage) GetSingularName() string {
	return strings.ToLower(v0alpha1.AnnotationKind().Kind())
}

func (s *SimpleLegacyAnnotationStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.tableConverter != nil {
		return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
	}
	return rest.NewDefaultTableConvertor(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}).ConvertToTable(ctx, object, tableOptions)
}

func (s *SimpleLegacyAnnotationStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, apierrors.NewNotFound(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, name)
}

func (s *SimpleLegacyAnnotationStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &v0alpha1.AnnotationList{
		Items: []v0alpha1.Annotation{},
	}, nil
}

func (s *SimpleLegacyAnnotationStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "create")
}

func (s *SimpleLegacyAnnotationStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "update")
}

func (s *SimpleLegacyAnnotationStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "delete")
}

func (s *SimpleLegacyAnnotationStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "deletecollection")
}
