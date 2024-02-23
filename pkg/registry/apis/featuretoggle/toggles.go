package featuretoggle

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ rest.Storage              = (*togglesStorage)(nil)
	_ rest.Scoper               = (*togglesStorage)(nil)
	_ rest.SingularNameProvider = (*togglesStorage)(nil)
	_ rest.Lister               = (*togglesStorage)(nil)
	_ rest.Getter               = (*togglesStorage)(nil)
)

type togglesStorage struct {
	resource       *common.ResourceInfo
	tableConverter rest.TableConvertor

	// The startup toggles
	startup *v0alpha1.FeatureToggles
}

func NewTogglesStorage(features *featuremgmt.FeatureManager) *togglesStorage {
	resourceInfo := v0alpha1.TogglesResourceInfo
	return &togglesStorage{
		resource: &resourceInfo,
		startup: &v0alpha1.FeatureToggles{
			TypeMeta: resourceInfo.TypeMeta(),
			ObjectMeta: metav1.ObjectMeta{
				Name:              "startup",
				Namespace:         "system",
				CreationTimestamp: metav1.Now(),
			},
			Spec: features.GetStartupFlags(),
		},
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
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
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
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
