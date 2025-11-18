package snapshot

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	v0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Scoper               = (*optionsStorage)(nil)
	_ rest.SingularNameProvider = (*optionsStorage)(nil)
	_ rest.Getter               = (*optionsStorage)(nil)
	_ rest.Lister               = (*optionsStorage)(nil)
	_ rest.Storage              = (*optionsStorage)(nil)
)

type SharingOptionGetter = func(namespace string) (*v0alpha1.SharingOption, error)

func NewSharingOptionGetter(cfg *setting.Cfg) SharingOptionGetter {
	s := &v0alpha1.SharingOption{
		ObjectMeta: metav1.ObjectMeta{
			CreationTimestamp: metav1.Now(),
		},
		Spec: v0alpha1.SharingOptionSpec{
			SnapshotsEnabled:     &cfg.SnapshotEnabled,
			ExternalSnapshotURL:  &cfg.ExternalSnapshotUrl,
			ExternalSnapshotName: &cfg.ExternalSnapshotName,
			ExternalEnabled:      &cfg.ExternalEnabled,
		},
	}
	return func(namespace string) (*v0alpha1.SharingOption, error) {
		return s, nil
	}
}

type optionsStorage struct {
	getter         SharingOptionGetter
	tableConverter rest.TableConvertor
}

func (s *optionsStorage) New() runtime.Object {
	return &v0alpha1.SharingOption{}
}

func (s *optionsStorage) Destroy() {}

func (s *optionsStorage) NamespaceScoped() bool {
	return true
}

func (s *optionsStorage) GetSingularName() string {
	return "Options"
}

func (s *optionsStorage) NewList() runtime.Object {
	return &v0alpha1.SharingOptionList{}
}

func (s *optionsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *optionsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	if info.OrgID < 0 {
		return nil, fmt.Errorf("missing namespace")
	}
	v, err := s.getter(info.Value)
	if err != nil {
		return nil, err
	}
	list := &v0alpha1.SharingOptionList{
		Items: []v0alpha1.SharingOption{*v},
	}
	return list, nil
}

func (s *optionsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.getter(name)
}
