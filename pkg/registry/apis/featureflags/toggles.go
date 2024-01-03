package featureflags

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
)

var (
	_ rest.Storage              = (*togglesStorage)(nil)
	_ rest.Scoper               = (*togglesStorage)(nil)
	_ rest.SingularNameProvider = (*togglesStorage)(nil)
	_ rest.Lister               = (*togglesStorage)(nil)
	_ rest.Getter               = (*togglesStorage)(nil)
)

type togglesStorage struct {
	resource *apis.ResourceInfo
	store    *genericregistry.Store
	features *featuremgmt.FeatureManager

	// The startup toggles
	startup *v0alpha1.FeatureToggles
}

func NewTogglesStorage(scheme *runtime.Scheme, features *featuremgmt.FeatureManager) *togglesStorage {
	resourceInfo := v0alpha1.TogglesResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	store.TableConvertor = rest.NewDefaultTableConvertor(store.DefaultQualifiedResource)

	startup := &v0alpha1.FeatureToggles{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "startup",
			Namespace:         "system",
			CreationTimestamp: metav1.Now(),
		},
		Spec:   features.GetEnabled(context.Background()),
		Status: v0alpha1.ToggleStatus{},
	}

	lookup := map[string]featuremgmt.FeatureFlag{}
	for _, f := range features.GetFlags() {
		lookup[f.Name] = f
	}

	// Find runtime state
	for k, v := range startup.Spec {
		state := v0alpha1.ToggleState{
			Feature: k,
			Enabled: v,
			Source:  "startup",
		}
		f, ok := lookup[k]
		if ok {
			if v && f.Expression == "true" {
				state.Source = "default"
			}
		} else {
			state.Warning = "unknown feature flag"
		}
		startup.Status.Toggles = append(startup.Status.Toggles, state)
	}

	return &togglesStorage{
		resource: &resourceInfo,
		store:    store,
		features: features,
		startup:  startup,
	}
}

func (s *togglesStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *togglesStorage) Destroy() {}

func (s *togglesStorage) NamespaceScoped() bool {
	return true
}

func (s *togglesStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

func (s *togglesStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

func (s *togglesStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *togglesStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	flags := &v0alpha1.FeatureTogglesList{
		Items: []v0alpha1.FeatureToggles{*s.startup},
	}
	return flags, nil
}

func (s *togglesStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, false) // allow system
	if err != nil {
		return nil, err
	}
	if info.Value != "" && info.Value != "system" {
		return nil, fmt.Errorf("only system namespace is currently supported")
	}
	if name != "startup" {
		return nil, fmt.Errorf("only system/startup is currently supported")
	}
	return s.startup, nil
}
