package receiver

import (
	"fmt"

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
	legacySvc ReceiverService,
	namespacer request.NamespaceMapper,
	scheme *runtime.Scheme,
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
	metadata MetadataService,
) (rest.Storage, error) {
	legacyStore := &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: resourceInfo.TableConverter(),
		metadata:       metadata,
	}
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
		if err != nil {
			return nil, err
		}
		return dualWriteBuilder(resourceInfo.GroupResource(), legacyStore, store)
	}
	return legacyStore, nil
}

func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	if s, ok := obj.(*model.Receiver); ok {
		return s.Labels, model.SelectableReceiverFields(s), nil
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
