package v0alpha1

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Scoper               = (*staticStorage)(nil)
	_ rest.SingularNameProvider = (*staticStorage)(nil)
	_ rest.Lister               = (*staticStorage)(nil)
	_ rest.Storage              = (*staticStorage)(nil)
)

type staticStorage struct {
	info RuntimeInfo
}

func newDeploymentInfoStorage() *staticStorage {
	return &staticStorage{
		info: RuntimeInfo{
			TypeMeta: metav1.TypeMeta{
				APIVersion: APIVersion,
				Kind:       "DeploymentInfo",
			},
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
	return &RuntimeInfo{}
}

func (s *staticStorage) Destroy() {}

func (s *staticStorage) NamespaceScoped() bool {
	return false
}

func (s *staticStorage) GetSingularName() string {
	return "runtime"
}

func (s *staticStorage) NewList() runtime.Object {
	return &RuntimeInfo{}
}

func (s *staticStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return rest.NewDefaultTableConvertor(Resource("runtime")).ConvertToTable(ctx, object, tableOptions)
}

func (s *staticStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &s.info, nil
}
