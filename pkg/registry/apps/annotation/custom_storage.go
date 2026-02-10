package annotation

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	_ grafanarest.Storage       = (*customAnnotationStorage)(nil)
	_ rest.Scoper               = (*customAnnotationStorage)(nil)
	_ rest.SingularNameProvider = (*customAnnotationStorage)(nil)
	_ rest.Getter               = (*customAnnotationStorage)(nil)
	_ rest.Lister               = (*customAnnotationStorage)(nil)
	_ rest.Creater              = (*customAnnotationStorage)(nil)
	_ rest.Updater              = (*customAnnotationStorage)(nil)
	_ rest.GracefulDeleter      = (*customAnnotationStorage)(nil)
	_ rest.CollectionDeleter    = (*customAnnotationStorage)(nil)
)

// customAnnotationStorage is the new custom storage implementation for annotations.
// This will be used as the "unified" storage in dual-write mode, migrating from the
// legacy SQL-based storage.
type customAnnotationStorage struct{}

// NewCustomAnnotationStorage creates a new instance of the custom annotation storage
func NewCustomAnnotationStorage() *customAnnotationStorage {
	return &customAnnotationStorage{}
}

// New returns a new empty Annotation object
func (s *customAnnotationStorage) New() runtime.Object {
	return annotationV0.AnnotationKind().ZeroValue()
}

// NewList returns a new empty AnnotationList object
func (s *customAnnotationStorage) NewList() runtime.Object {
	return annotationV0.AnnotationKind().ZeroListValue()
}

// Destroy cleans up resources
func (s *customAnnotationStorage) Destroy() {}

// NamespaceScoped returns true since annotations are namespace-scoped (namespace == org)
func (s *customAnnotationStorage) NamespaceScoped() bool {
	return true
}

// GetSingularName returns the singular name of the resource
func (s *customAnnotationStorage) GetSingularName() string {
	return "annotation"
}

// ConvertToTable converts objects to table format for kubectl-style output
func (s *customAnnotationStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}

// Get retrieves a single annotation by name
func (s *customAnnotationStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("customAnnotationStorage.Get not implemented")
}

// List retrieves a list of annotations based on options
func (s *customAnnotationStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &annotationV0.AnnotationList{
		Items:    []annotationV0.Annotation{},
		ListMeta: metav1.ListMeta{Continue: ""},
	}, nil
}

// Create creates a new annotation
func (s *customAnnotationStorage) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, fmt.Errorf("customAnnotationStorage.Create not implemented")
}

// Update updates an existing annotation
func (s *customAnnotationStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("customAnnotationStorage.Update not implemented")
}

// Delete deletes an annotation by name
func (s *customAnnotationStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("customAnnotationStorage.Delete not implemented")
}

// DeleteCollection deletes multiple annotations based on list options
func (s *customAnnotationStorage) DeleteCollection(
	ctx context.Context,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
	listOptions *internalversion.ListOptions,
) (runtime.Object, error) {
	return nil, fmt.Errorf("customAnnotationStorage.DeleteCollection not implemented")
}
