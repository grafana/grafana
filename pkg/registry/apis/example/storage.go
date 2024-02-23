package example

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Storage              = (*staticStorage)(nil)
	_ rest.Scoper               = (*staticStorage)(nil)
	_ rest.SingularNameProvider = (*staticStorage)(nil)
	_ rest.Lister               = (*staticStorage)(nil)
)

type staticStorage struct {
	Store *genericregistry.Store
	info  example.RuntimeInfo
}

func newDeploymentInfoStorage(gv schema.GroupVersion, scheme *runtime.Scheme) *staticStorage {
	var resourceInfo = example.RuntimeResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}

	return &staticStorage{
		Store: store,
		info: example.RuntimeInfo{
			TypeMeta:              example.RuntimeResourceInfo.TypeMeta(),
			BuildVersion:          setting.BuildVersion,
			BuildCommit:           setting.BuildCommit,
			BuildBranch:           setting.BuildBranch,
			EnterpriseBuildCommit: setting.EnterpriseBuildCommit,
			BuildStamp:            setting.BuildStamp,
			IsEnterprise:          setting.IsEnterprise,
			Packaging:             setting.Packaging,
			StartupTime:           time.Now().UnixMilli(),
		},
	}
}

func (s *staticStorage) New() runtime.Object {
	return s.Store.New()
}

func (s *staticStorage) Destroy() {}

func (s *staticStorage) NamespaceScoped() bool {
	return false
}

func (s *staticStorage) GetSingularName() string {
	return example.RuntimeResourceInfo.GetSingularName()
}

func (s *staticStorage) NewList() runtime.Object {
	return s.Store.NewListFunc()
}

func (s *staticStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.Store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *staticStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &s.info, nil
}
