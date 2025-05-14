package featuretoggle

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*featuresStorage)(nil)
	_ rest.Scoper               = (*featuresStorage)(nil)
	_ rest.SingularNameProvider = (*featuresStorage)(nil)
	_ rest.Lister               = (*featuresStorage)(nil)
	_ rest.Getter               = (*featuresStorage)(nil)
)

type featuresStorage struct {
	resource       *utils.ResourceInfo
	tableConverter rest.TableConvertor
	features       *v0alpha1.FeatureList
	featuresOnce   sync.Once
}

// NOTE! this does not depend on config or any system state!
// In the future, the existence of features (and their properties) can be defined dynamically
func NewFeaturesStorage() *featuresStorage {
	resourceInfo := v0alpha1.FeatureResourceInfo
	return &featuresStorage{
		resource:       &resourceInfo,
		tableConverter: resourceInfo.TableConverter(),
	}
}

func (s *featuresStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *featuresStorage) Destroy() {}

func (s *featuresStorage) NamespaceScoped() bool {
	return false
}

func (s *featuresStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

func (s *featuresStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

func (s *featuresStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *featuresStorage) init() {
	s.featuresOnce.Do(func() {
		rv := "1"
		features, _ := featuremgmt.GetEmbeddedFeatureList()
		for _, feature := range features.Items {
			if feature.ResourceVersion > rv {
				rv = feature.ResourceVersion
			}
		}
		features.ResourceVersion = rv
		s.features = &features
	})
}

func (s *featuresStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	s.init()
	if s.features == nil {
		return nil, fmt.Errorf("error loading embedded features")
	}
	return s.features, nil
}

func (s *featuresStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	s.init()

	for idx, flag := range s.features.Items {
		if flag.Name == name {
			return &s.features.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}
