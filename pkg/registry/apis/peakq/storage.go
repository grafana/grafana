package peakq

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/storage/names"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

type peakQCreateStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

func (peakQCreateStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	user, _ := appcontext.User(ctx)
	template := obj.(*peakq.QueryTemplate)
	template.Annotations = map[string]string{"grafana.app/createdBy": user.Email}
}

func (peakQCreateStrategy) Canonicalize(obj runtime.Object) {}

func (peakQCreateStrategy) NamespaceScoped() bool {
	return true
}

func (peakQCreateStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (peakQCreateStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	return nil
}

func newStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)
	createStrategy := peakQCreateStrategy{scheme, names.SimpleNameGenerator}

	resourceInfo := peakq.QueryTemplateResourceInfo
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor: utils.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*peakq.QueryTemplate)
				if !ok {
					return nil, fmt.Errorf("expected query template")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
		CreateStrategy: createStrategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func (s *storage) Compare(storageObj, legacyObj runtime.Object) bool {
	//TODO: define the comparison logic between a query template returned by the storage and a query template returned by the legacy storage
	return false
}
