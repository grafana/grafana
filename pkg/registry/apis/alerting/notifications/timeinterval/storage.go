package timeinterval

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	apistore "k8s.io/apiserver/pkg/storage"

	model "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func (s storage) Compare(storageObj, legacyObj runtime.Object) bool {
	// TODO implement when supported dual write mode is not Mode0
	return false
}

func NewStorage(
	legacySvc TimeIntervalService,
	namespacer request.NamespaceMapper,
	scheme *runtime.Scheme,
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (rest.Storage, error) {
	legacyStore := &legacyStorage{
		service:    legacySvc,
		namespacer: namespacer,
		tableConverter: utils.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				// {Name: "Intervals", Type: "string", Format: "string", Description: "The display name"},
			},
			func(obj any) ([]interface{}, error) {
				r, ok := obj.(*model.TimeInterval)
				if ok {
					return []interface{}{
						r.Name,
						// r.Spec, //TODO implement formatting for Spec, same as UI?
					}, nil
				}
				return nil, fmt.Errorf("expected resource or info")
			}),
	}
	if optsGetter != nil && dualWriteBuilder != nil {
		strategy := grafanaregistry.NewStrategy(scheme)
		s := &genericregistry.Store{
			NewFunc:                   resourceInfo.NewFunc,
			NewListFunc:               resourceInfo.NewListFunc,
			KeyRootFunc:               grafanaregistry.KeyRootFunc(resourceInfo.GroupResource()),
			KeyFunc:                   grafanaregistry.NamespaceKeyFunc(resourceInfo.GroupResource()),
			PredicateFunc:             Matcher,
			DefaultQualifiedResource:  resourceInfo.GroupResource(),
			SingularQualifiedResource: resourceInfo.SingularGroupResource(),
			TableConvertor:            legacyStore.tableConverter,
			CreateStrategy:            strategy,
			UpdateStrategy:            strategy,
			DeleteStrategy:            strategy,
		}
		options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
		if err := s.CompleteWithOptions(options); err != nil {
			return nil, err
		}
		return dualWriteBuilder(resourceInfo.GroupResource(), legacyStore, storage{Store: s})
	}
	return legacyStore, nil
}

func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	if s, ok := obj.(*model.TimeInterval); ok {
		return s.Labels, model.SelectableTimeIntervalsFields(s), nil
	}
	return nil, nil, fmt.Errorf("object of type %T is not supported", obj)
}

// Matcher returns a generic.SelectionPredicate that matches on label and field selectors.
func Matcher(label labels.Selector, field fields.Selector) apistore.SelectionPredicate {
	return apistore.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}
