package snapshots

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Scoper               = (*optionsStorage)(nil)
	_ rest.SingularNameProvider = (*optionsStorage)(nil)
	_ rest.Getter               = (*optionsStorage)(nil)
	_ rest.Lister               = (*optionsStorage)(nil)
	_ rest.Storage              = (*optionsStorage)(nil)
	_ rest.Creater              = (*optionsStorage)(nil)
	_ rest.GracefulDeleter      = (*optionsStorage)(nil)
)

type sharingOptionsGetter = func(namespace string) (*snapshots.SnapshotSharingConfig, error)

func newSharingOptionsGetter(cfg *setting.Cfg) sharingOptionsGetter {
	s := &snapshots.SnapshotSharingConfig{
		ObjectMeta: metav1.ObjectMeta{
			CreationTimestamp: metav1.Now(),
		},
		SnapshotSharingOptions: snapshots.SnapshotSharingOptions{
			SnapshotsEnabled:     cfg.SnapshotEnabled,
			ExternalSnapshotURL:  cfg.ExternalSnapshotUrl,
			ExternalSnapshotName: cfg.ExternalSnapshotName,
			ExternalEnabled:      cfg.ExternalEnabled,
		},
	}
	return func(namespace string) (*snapshots.SnapshotSharingConfig, error) {
		return s, nil
	}
}

type optionsStorage struct {
	getter         sharingOptionsGetter
	tableConverter rest.TableConvertor
}

func (s *optionsStorage) New() runtime.Object {
	return &snapshots.SnapshotSharingConfig{}
}

func (s *optionsStorage) Destroy() {}

func (s *optionsStorage) NamespaceScoped() bool {
	return true // name == namespace/tenant??
}

func (s *optionsStorage) GetSingularName() string {
	return "options"
}

func (s *optionsStorage) NewList() runtime.Object {
	return &snapshots.SnapshotSharingConfig{}
}

func (s *optionsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *optionsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.getter("xxx")
}

func (s *optionsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.getter(name)
}

func (s *optionsStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented yet")
}

// GracefulDeleter
func (s *optionsStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("not implemented yet")
}
