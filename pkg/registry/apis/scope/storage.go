package scope

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	apistore "k8s.io/apiserver/pkg/storage"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newScopeStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)

	resourceInfo := scope.ScopeResourceInfo
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor: gapiutil.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
				{Name: "Title", Type: "string"},
				{Name: "Filters", Type: "array"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*scope.Scope)
				if !ok {
					return nil, fmt.Errorf("expected scope")
				}
				return []interface{}{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
					m.Spec.Title,
					m.Spec.Filters,
				}, nil
			},
		),
		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}

func newScopeDashboardBindingStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)

	resourceInfo := scope.ScopeDashboardBindingResourceInfo
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor: gapiutil.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
				{Name: "Dashboard", Type: "string"},
				{Name: "Scope", Type: "string"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*scope.ScopeDashboardBinding)
				if !ok {
					return nil, fmt.Errorf("expected scope dashboard binding")
				}
				return []interface{}{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
					m.Spec.Dashboard,
					m.Spec.Scope,
				}, nil
			},
		),
		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}

func newScopeNodeStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)

	resourceInfo := scope.ScopeNodeResourceInfo
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor: gapiutil.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
				{Name: "Title", Type: "string"},
				{Name: "Parent Name", Type: "string"},
				{Name: "Node Type", Type: "string"},
				{Name: "Link Type", Type: "string"},
				{Name: "Link ID", Type: "string"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*scope.ScopeNode)
				if !ok {
					return nil, fmt.Errorf("expected scope node")
				}
				return []interface{}{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
					m.Spec.Title,
					m.Spec.ParentName,
					m.Spec.NodeType,
					m.Spec.LinkType,
					m.Spec.LinkID,
				}, nil
			},
		),
		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}

func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	if s, ok := obj.(*scope.Scope); ok {
		return labels.Set(s.Labels), SelectableScopeFields(s), nil
	}
	if s, ok := obj.(*scope.ScopeDashboardBinding); ok {
		return labels.Set(s.Labels), SelectableScopeDashboardBindingFields(s), nil
	}
	if s, ok := obj.(*scope.ScopeNode); ok {
		return labels.Set(s.Labels), SelectableScopeNodeFields(s), nil
	}
	return nil, nil, fmt.Errorf("not a scope or ScopeDashboardBinding object")
}

// Matcher returns a generic.SelectionPredicate that matches on label and field selectors.
func Matcher(label labels.Selector, field fields.Selector) apistore.SelectionPredicate {
	return apistore.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}

func SelectableScopeFields(obj *scope.Scope) fields.Set {
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), fields.Set{
		"spec.title": obj.Spec.Title,
	})
}

func SelectableScopeDashboardBindingFields(obj *scope.ScopeDashboardBinding) fields.Set {
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), fields.Set{
		"spec.scope": obj.Spec.Scope,
	})
}

func SelectableScopeNodeFields(obj *scope.ScopeNode) fields.Set {
	parentName := ""

	if obj != nil {
		parentName = obj.Spec.ParentName
	}

	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), fields.Set{
		"spec.parentName": parentName,
	})
}

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func (s *storage) Compare(storageObj, legacyObj runtime.Object) bool {
	//TODO: define the comparison logic between a scope returned by the storage and a scope returned by the legacy storage
	return false
}
