package time_intervals

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
)

func NewStorage(legacySvc TimeIntervalService, namespacer request.NamespaceMapper, scheme *runtime.Scheme, dualWrite bool, optsGetter generic.RESTOptionsGetter) (rest.Storage, error) {
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
				r, ok := obj.(*notifications.TimeInterval)
				if ok {
					return []interface{}{
						r.Name,
						// r.Spec, //TODO implement formatting for Spec, same as UI?
					}, nil
				}
				return nil, fmt.Errorf("expected resource or info")
			}),
	}
	if dualWrite && optsGetter != nil {
		strategy := grafanaregistry.NewStrategy(scheme)
		s := &genericregistry.Store{
			NewFunc:                   resourceInfo.NewFunc,
			NewListFunc:               resourceInfo.NewListFunc,
			PredicateFunc:             grafanaregistry.Matcher,
			DefaultQualifiedResource:  resourceInfo.GroupResource(),
			SingularQualifiedResource: resourceInfo.SingularGroupResource(),
			TableConvertor:            legacyStore.tableConverter,
			CreateStrategy:            strategy,
			UpdateStrategy:            strategy,
			DeleteStrategy:            strategy,
		}
		options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
		if err := s.CompleteWithOptions(options); err != nil {
			return nil, err
		}
		return s, nil
	}
	return legacyStore, nil
}
