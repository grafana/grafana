package featureflags

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Storage              = (*flagsStorage)(nil)
	_ rest.Scoper               = (*flagsStorage)(nil)
	_ rest.SingularNameProvider = (*flagsStorage)(nil)
	_ rest.Lister               = (*flagsStorage)(nil)
	_ rest.Getter               = (*flagsStorage)(nil)
)

type flagsStorage struct {
	store    *genericregistry.Store
	features *featuremgmt.FeatureManager
	cfg      *setting.Cfg
}

func (s *flagsStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *flagsStorage) Destroy() {}

func (s *flagsStorage) NamespaceScoped() bool {
	return false
}

func (s *flagsStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *flagsStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *flagsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *flagsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	flags := &v0alpha1.FeatureList{}
	for _, flag := range s.features.GetFlags() {
		flags.Items = append(flags.Items, toK8sForm(flag))
	}
	return flags, nil
}

func (s *flagsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	for _, flag := range s.features.GetFlags() {
		if name == flag.Name {
			obj := toK8sForm(flag)
			return &obj, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func toK8sForm(flag featuremgmt.FeatureFlag) v0alpha1.Feature {
	return v0alpha1.Feature{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              flag.Name,
			CreationTimestamp: metav1.NewTime(flag.Created),
		},
		Spec: v0alpha1.FeatureSpec{
			Description:       flag.Description,
			Stage:             flag.Stage.String(),
			Owner:             string(flag.Owner),
			AllowSelfServe:    flag.AllowSelfServe,
			HideFromAdminPage: flag.HideFromAdminPage,
			HideFromDocs:      flag.HideFromDocs,
			FrontendOnly:      flag.FrontendOnly,
			RequiresDevMode:   flag.RequiresDevMode,
			RequiresRestart:   flag.RequiresRestart,
		},
	}
}
