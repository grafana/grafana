package provisioning

import (
	"errors"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	apistore "k8s.io/apiserver/pkg/storage"
)

type storage struct {
	*genericregistry.Store
}

var _ grafanarest.Storage = (*storage)(nil)

func newRepositoryStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	info := v0alpha1.RepositoryResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme, info.GroupVersion())
	store := &genericregistry.Store{
		NewFunc:                   info.NewFunc,
		NewListFunc:               info.NewListFunc,
		KeyRootFunc:               grafanaregistry.KeyRootFunc(info.GroupResource()),
		KeyFunc:                   grafanaregistry.NamespaceKeyFunc(info.GroupResource()),
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  info.GroupResource(),
		SingularQualifiedResource: info.SingularGroupResource(),
		TableConvertor:            info.TableConverter(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}

func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	if repo, ok := obj.(*v0alpha1.Repository); ok {
		return labels.Set(repo.Labels), SelectableRepositoryFields(repo), nil
	}
	return nil, nil, errors.New("not a Repository object")
}

// Matcher returns a generic.SelectionPredicate that matches on label and field selectors.
func Matcher(label labels.Selector, field fields.Selector) apistore.SelectionPredicate {
	return apistore.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}

func SelectableRepositoryFields(obj *v0alpha1.Repository) fields.Set {
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), fields.Set{
		// TODO: Add the subfields here.
	})
}
