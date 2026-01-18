package live

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	liveV1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

var (
	_ rest.Scoper               = (*channelStore)(nil)
	_ rest.SingularNameProvider = (*channelStore)(nil)
	_ rest.Lister               = (*channelStore)(nil)
	_ rest.Storage              = (*channelStore)(nil)
)

type channelStore struct {
	//
}

func (s *channelStore) New() runtime.Object {
	return liveV1.ChannelKind().ZeroValue()
}

func (s *channelStore) Destroy() {}

func (s *channelStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *channelStore) GetSingularName() string {
	return strings.ToLower(liveV1.ChannelKind().Kind())
}

func (s *channelStore) NewList() runtime.Object {
	return liveV1.ChannelKind().ZeroListValue()
}

func (s *channelStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, nil
}

func (s *channelStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	channels := &liveV1.ChannelList{}
	return channels, nil
}
