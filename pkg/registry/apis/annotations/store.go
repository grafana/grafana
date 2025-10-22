package annotations

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	annotationsV0 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
)

var (
	_ rest.Storage              = (*annotationStore)(nil)
	_ rest.Scoper               = (*annotationStore)(nil)
	_ rest.SingularNameProvider = (*annotationStore)(nil)
	_ rest.Lister               = (*annotationStore)(nil)
	_ rest.Getter               = (*annotationStore)(nil)
	_ rest.Creater              = (*annotationStore)(nil)
	_ rest.GracefulDeleter      = (*annotationStore)(nil)
)

// Exposes the annotation service as rest.Storage
type annotationStore struct {
	service        annotationsV0.Service
	tableConverter rest.TableConvertor
}

func newAnnotationStorage(service annotationsV0.Service) *annotationStore {
	return &annotationStore{
		service: service,
		tableConverter: rest.NewDefaultTableConvertor(
			schema.GroupResource{
				Group:    annotationsV0.APIGroup,
				Resource: "annotations",
			}),
	}
}

func (s *annotationStore) New() runtime.Object {
	return &annotationsV0.Annotation{}
}

func (s *annotationStore) Destroy() {}

func (s *annotationStore) NamespaceScoped() bool {
	return true
}

func (s *annotationStore) GetSingularName() string {
	return "Annotation"
}

func (s *annotationStore) NewList() runtime.Object {
	return &annotationsV0.AnnotationList{}
}

func (s *annotationStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *annotationStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.service.Find(ctx, &annotationsV0.AnnotationQuery{
		Limit:    options.Limit,
		Continue: options.Continue,
	})
}

func (s *annotationStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	rsp, err := s.service.Find(ctx, &annotationsV0.AnnotationQuery{
		Annotation: name,
		Limit:      2,
	})
	if err != nil {
		return nil, err
	}
	if len(rsp.Items) > 1 {
		return nil, fmt.Errorf("expected single item, got multiple")
	}
	if len(rsp.Items) == 0 {
		return nil, apierrors.NewNotFound(schema.GroupResource{
			Group:    annotationsV0.APIGroup,
			Resource: "annotations",
		}, name)
	}
	return &rsp.Items[0], nil
}

// Create implements rest.Creater.
func (s *annotationStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	v, ok := obj.(*annotationsV0.Annotation)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected annotation, got %T", obj))
	}
	rsp, err := s.service.Append(ctx, []annotationsV0.AnnotationSpec{v.Spec})
	if err != nil {
		return nil, err
	}
	if len(rsp.Items) != 1 {
		return nil, fmt.Errorf("expected single item, got multiple")
	}
	return &rsp.Items[0], nil
}

// Delete implements rest.GracefulDeleter.
func (s *annotationStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	err := s.service.Remove(ctx, name)
	return nil, (err == nil), err
}
